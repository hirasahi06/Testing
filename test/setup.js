// test/setup.js
require('dotenv').config();

const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const chromedriver = require('chromedriver');

// ---- ENV ----
const APP_URL       = process.env.APP_URL || 'https://3.finance';
const USER_DATA_DIR = process.env.CHROME_USER_DATA;     // e.g. C:\Users\You\AppData\Local\Google\Chrome\User Data
const PROFILE_DIR   = process.env.CHROME_PROFILE || 'Profile 1'; // exact folder name (NOT "Default" unless that’s the folder)
const CHROME_BIN    = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// ---- ChromeDriver service (note: ServiceBuilder INSTANCE, not .build()) ----
const serviceBuilder = new chrome.ServiceBuilder(chromedriver.path)
  .loggingTo('chromedriver.log');

// ---- Chrome options ----
const options = new chrome.Options()
  .setChromeBinaryPath(CHROME_BIN)
  .addArguments('--start-maximized')
  .addArguments('--disable-gpu')
  .addArguments('--disable-dev-shm-usage')
  .addArguments('--no-sandbox')
  .excludeSwitches('enable-automation')
  .addArguments('--disable-blink-features=AutomationControlled');

if (USER_DATA_DIR) options.addArguments(`--user-data-dir=${USER_DATA_DIR}`);
if (PROFILE_DIR)   options.addArguments(`--profile-directory=${PROFILE_DIR}`);

let driver;

// Mocha root hook plugin (works with --require/-r)
exports.mochaHooks = {
  beforeAll: async function () {
    this.timeout(60000);
    console.log('\n⚙️  Starting Chrome via Selenium…');
    console.log('🌐 APP_URL =', APP_URL);
    console.log('🔧 Chrome binary:', CHROME_BIN);
    console.log('👤 Profile path:', `${USER_DATA_DIR}\\${PROFILE_DIR}`);

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .setChromeService(serviceBuilder)
      .build();

    global.__driver = driver; // expose to tests
  },

  afterAll: async function () {
    if (driver) {
      await driver.quit();
    }
  }
};
