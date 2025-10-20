const { Builder, By, until, Browser } = require('selenium-webdriver');
const chrome = require('selenium-webdriver').chrome;  // This is the correct CommonJS way to import
const { expect } = require("chai");

describe("Automation Exercise Tests", function () {
  this.timeout(40000);

  let driver;

  before(async function () {
    const options = new chrome.Options();
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");

    driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(options)
      .build();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it("should open product details page", async function () {
    await driver.get("https://automationexercise.com/product_details/4");
    const title = await driver.getTitle();
    console.log("Page title:", title);
    expect(title).to.include("Product Details");
  });
});
