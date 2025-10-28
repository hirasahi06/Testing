// test/deposit-ui.spec.js
require('dotenv').config();

const { By, Key, until } = require('selenium-webdriver');

const APP_URL        = process.env.APP_URL;
const VIEW_NAME      = (process.env.VIEWS || 'Community').trim();  // 'Community' | 'Protocol'
const MODULE_NAME    = (process.env.SPACES || 'Grove').trim();     // 'Grove', 'The Guild', etc.
const CDP_NAME       = (process.env.CDP_NAME || 'sdCRV').trim();   // 'sdCRV'
const DEPOSIT_AMOUNT = Number(process.env.DEPOSIT_AMOUNT || '10000');
const RAW_SELECTOR   = (process.env.SDCRV_AMOUNT_SELECTOR || '').trim();

const SDCRV_SELECTOR = stripWrappingQuotes(RAW_SELECTOR);

function stripWrappingQuotes(s) {
  if (!s) return s;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

describe('3fi sdCRV UI deposit (full E2E with wallet confirm)', function () {
  this.timeout(180000);
  let driver;

  before(() => {
    driver = global.__driver;
    if (!driver) throw new Error('WebDriver not initialized (check test/setup.js)');
    if (!APP_URL) throw new Error('Missing APP_URL in .env');
  });

  it('navigates UI, deposits, confirms in wallet, and verifies increase', async () => {
    await driver.get(APP_URL);

    // Wait for landing to render something recognizable
    await driver.wait(waitForAnyText(['Compose Assets', 'Compose Assets', 'Assets', 'Views', 'VIEWS']), 30000);

    // If there is a "Compose assets" entry point, click it (best effort)
    await clickIfExistsText('Compose Assets', 2000);

    // Choose view via icon (hover to reveal label)
    await chooseView(driver, VIEW_NAME);

    // Click the Space/Module (e.g., Grove)
    await clickByTextAny([MODULE_NAME], 10000);

    // Click the CDP name (sdCRV)
    await clickByTextAny([CDP_NAME, CDP_NAME.toUpperCase(), CDP_NAME.toLowerCase()], 10000);

    // We’re on sdCRV panel – capture visible amount BEFORE
    const beforeVal = await getSdcrvVisibleAmount(driver, SDCRV_SELECTOR, CDP_NAME);
    console.log('UI sdCRV (before):', beforeVal);

    // Open Actions → Deposit
    await clickByTextAny(['Actions', 'Action', 'ACTIONS'], 10000);
    await clickByTextAny(['Deposit', 'Deposits'], 10000);

    // Type amount and trigger the flow
    await typeIntoFirstNumberInput(String(DEPOSIT_AMOUNT));

    // Click Approve then Deposit (best-effort; some UIs merge these steps)
    await clickIfExistsText('Approve', 4000);
    await clickIfExistsText('Deposit', 4000);
    await clickIfExistsText('Confirm', 3000); // sometimes a confirm modal

    // Confirm in wallet popup (MetaMask/Rabby)
    await confirmInWalletPopup(driver);

    // Allow indexer/graph to update UI, then refresh and re-read
    await sleep(5000);
    await driver.navigate().refresh();
    await driver.wait(waitForAnyText([CDP_NAME, 'Deposit', 'Withdraw', 'Balance']), 30000);

    const afterVal = await getSdCRVAfterWithRetry(driver, SDCRV_SELECTOR, CDP_NAME, beforeVal);

    console.log('UI sdCRV (after):', afterVal);
    const delta = afterVal - beforeVal;
    const tolerance = Math.max(1, DEPOSIT_AMOUNT * 0.02); // 2% wiggle or 1 unit
    if (Math.abs(delta - DEPOSIT_AMOUNT) > tolerance) {
      throw new Error(`Expected UI to increase by ~${DEPOSIT_AMOUNT} (before=${beforeVal}, after=${afterVal})`);
    }
  });

  // ---------- helpers ----------

  function findByExactText(text) {
    return By.xpath(`//*[normalize-space(text())="${text}"]`);
  }

  function waitForAnyText(texts) {
    return async (drv) => {
      for (const t of texts) {
        const els = await drv.findElements(findByExactText(t));
        if (els.length) return true;
      }
      return false;
    };
  }

  async function clickByText(text, timeoutMs = 10000) {
    const el = await driver.wait(until.elementLocated(findByExactText(text)), timeoutMs);
    await driver.wait(until.elementIsVisible(el), 10000);
    await scrollIntoView(el);
    await el.click();
  }

  async function clickIfExistsText(text, timeoutMs = 1500) {
    try {
      const el = await driver.wait(until.elementLocated(findByExactText(text)), timeoutMs);
      await driver.wait(until.elementIsVisible(el), 500);
      await scrollIntoView(el);
      await el.click();
      return true;
    } catch {
      return false;
    }
  }

  async function clickByTextAny(texts, timeoutMs = 10000) {
    const start = Date.now();
    for (const t of texts) {
      try {
        await clickByText(t, Math.max(500, timeoutMs - (Date.now() - start)));
        return;
      } catch (_) { /* next */ }
    }
    throw new Error(`Could not find any of: ${texts.join(', ')}`);
  }

  async function typeIntoFirstNumberInput(value) {
    const candidates = [
      By.css('input[type="number"]'),
      By.css('input[placeholder*="qty" i]'),
      By.css('input[placeholder*="quantity" i]'),
      By.css('input[placeholder*="amount" i]'),
      By.css('input')
    ];
    for (const loc of candidates) {
      const found = await driver.findElements(loc);
      if (found.length) {
        const el = found[0];
        await driver.wait(until.elementIsVisible(el), 5000);
        await scrollIntoView(el);
        await el.clear();
        await el.sendKeys(value, Key.TAB);
        return;
      }
    }
    throw new Error('Could not find an amount input field to type into.');
  }

  async function getSdCRVAfterWithRetry(drv, cssSelector, cdpName, beforeVal) {
    // Try up to 3 times (refresh between tries)
    for (let i = 0; i < 3; i++) {
      const val = await getSdcrvVisibleAmount(drv, cssSelector, cdpName);
      if (val > beforeVal) return val;
      await sleep(2500);
      await drv.navigate().refresh();
      await drv.wait(waitForAnyText([cdpName, 'Deposit', 'Withdraw', 'Balance']), 30000);
    }
    return await getSdcrvVisibleAmount(drv, cssSelector, cdpName);
  }

  async function getSdcrvVisibleAmount(drv, cssSelector, cdpName) {
    if (cssSelector) {
      const el = await drv.wait(until.elementLocated(By.css(cssSelector)), 20000);
      await drv.wait(until.elementIsVisible(el), 10000);
      const txt = (await el.getText()).trim();
      return parseVisibleNumber(txt);
    }
    // Generic: find first container mentioning the CDP and parse numbers
    const row = await drv.wait(
      until.elementLocated(
        By.xpath(`//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${cdpName.toLowerCase()}')]/ancestor-or-self::*[1]`)
      ),
      20000
    );
    const cells = await row.findElements(By.xpath(".//*[self::div or self::span or self::p or self::td]"));
    let best = 0;
    for (const el of cells) {
      const txt = (await el.getText()).trim();
      const n = parseVisibleNumber(txt);
      if (n > best) best = n;
    }
    return best;
  }

  function parseVisibleNumber(s) {
    const cleaned = s.replace(/[^\d.\-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  async function scrollIntoView(el) {
    await driver.executeScript('arguments[0].scrollIntoView({block:"center", inline:"center"});', el);
    await sleep(100);
  }

  async function chooseView(drv, view /* 'Community' | 'Protocol' */) {
    const label = view.trim();

    // 1) aria-label / title (best case for icon buttons)
    const a11y = await drv.findElements(
      By.css(`[aria-label="${label}"],[title="${label}"]`)
    );
    if (a11y.length) {
      await hoverAndClick(drv, a11y[0]);
      return;
    }

    // 2) Try to hover icons within a section containing "Views"
    const viewsSection = await firstOrNull([
      () => drv.findElement(By.xpath(`//*[translate(normalize-space(.), 'views', 'VIEWS')='VIEWS']/ancestor::*[self::section or self::div][1]`)),
      () => drv.findElement(By.xpath(`//*[contains(., 'Views') or contains(., 'VIEWS')]/ancestor::*[self::section or self::div][1]`))
    ]);

    const scope = viewsSection || (await drv.findElement(By.tagName('body')));
    const candidates = await scope.findElements(
      By.css('button,[role="button"],a,[data-testid],[class*="icon"]')
    );

    for (const el of candidates) {
      try {
        await drv.actions({ async: true }).move({ origin: el }).perform();
        await sleep(150);
        const tooltip = await drv.findElements(
          By.xpath(`//*[(@role='tooltip' or contains(@class,'tooltip') or contains(@class,'tippy-content')) and contains(., '${label}')]`)
        );
        if (tooltip.length) {
          await el.click();
          return;
        }
      } catch { /* keep scanning */ }
    }

    // 3) As a last resort try clicking visible text “Community” or “Protocol”
    if (await clickIfExistsText(label, 1000)) return;

    throw new Error(`Could not find '${label}' view icon to click`);
  }

  async function hoverAndClick(drv, el) {
    await drv.actions({ async: true }).move({ origin: el }).perform();
    await sleep(120);
    await el.click();
  }

  async function firstOrNull(fns) {
    for (const fn of fns) {
      try { return await fn(); } catch {}
    }
    return null;
  }

  async function confirmInWalletPopup(drv) {
    const main = await drv.getWindowHandle();
    await waitForNewWindow(drv, 15000);

    const handles = await drv.getAllWindowHandles();
    for (const h of handles) {
      if (h === main) continue;
      await drv.switchTo().window(h);
      const title = await safeGetTitle(drv);
      const url = await safeGetUrl(drv);

      const looksLikeWallet =
        /metamask|rabby/i.test(title) ||
        /chrome-extension:\/\//i.test(url);

      if (!looksLikeWallet) continue;

      // common confirm buttons in MetaMask/Rabby
      if (await clickIfExists(By.xpath(`//*[normalize-space(text())="Confirm"]`), 2500)) break;
      if (await clickIfExists(By.xpath(`//*[normalize-space(text())="Approve"]`), 2000)) break;
      if (await clickIfExists(By.xpath(`//*[normalize-space(text())="Sign"]`), 2000)) break;
    }

    await drv.switchTo().window(main);
  }

  async function safeGetTitle(drv) { try { return await drv.getTitle(); } catch { return ''; } }
  async function safeGetUrl(drv)   { try { return await drv.getCurrentUrl(); } catch { return ''; } }

  async function waitForNewWindow(drv, timeoutMs) {
    const start = Date.now();
    const base = (await drv.getAllWindowHandles()).length;
    while (Date.now() - start < timeoutMs) {
      const now = (await drv.getAllWindowHandles()).length;
      if (now > base) return true;
      await sleep(200);
    }
    return false;
  }

  async function clickIfExists(locator, timeoutMs = 1500) {
    try {
      const el = await driver.wait(until.elementLocated(locator), timeoutMs);
      await driver.wait(until.elementIsVisible(el), 800);
      await scrollIntoView(el);
      await el.click();
      return true;
    } catch { return false; }
  }
});
