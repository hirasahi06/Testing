// cat > test.js <<'JS'
import { Builder, Browser } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { expect } from 'chai';

describe("Google Homepage Test", function () {
  let driver;

  before(async function () {
    // If you want to see the browser, remove "--headless" below
    const options = new chrome.Options();
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    // options.addArguments("--window-size=1920,1080"); // optional

    driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(options)
      .build();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it("should open Google homepage", async function () {
    this.timeout(30000);
    await driver.get("https://www.google.com");
    const title = await driver.getTitle();
    console.log("Page title is:", title);
    expect(title).to.include("Google");
  });
});

