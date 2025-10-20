import { Builder, By, Browser } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { expect } from 'chai';

describe('Automation Exercise Tests', function () {
  this.timeout(40000);

  let driver;

  before(async function () 
  {
    const options = new chrome.Options();
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');

    driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(options)
      .build();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it('should open product details page', async function () {
    await driver.get('https://automationexercise.com/product_details/4');
    const title = await driver.getTitle();
    console.log('Page title:', title);
    expect(title).to.include('Product Details');
  });
});
