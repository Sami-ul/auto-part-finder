const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

(async () => {
  console.log('Hello');
  // Launch Puppeteer and open a new page.
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to the starting page.
  await page.goto('http://www.rockauto.com/en/catalog/');
  await page.type('.topsearchinput', '2025 honda cr-v 1.5l l4 turbocharged rotor\n');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ]);

  // After the navigation, you can retrieve the new URL:
  const newUrl = page.url();
  console.log('New URL:', newUrl);

  // Or get the HTML content of the loaded page:
//   const htmlContent = await page.content();
//   console.log('Page HTML:', htmlContent);

  // You can then process htmlContent with Cheerio or any other HTML parser if needed.
  
  await browser.close();
})();
