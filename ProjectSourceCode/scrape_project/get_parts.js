const cheerio = require('cheerio');
const fs = require('fs');
const puppeteer = require('puppeteer');

function extractVehicleData(html) {
    const $ = cheerio.load(html);
    let foundRecord = null;

    // Look for input fields within elements having the "ranavnode" class.
    $('div.ranavnode input[id^="jsn["]').each((i, elem) => {
        let rawValue = $(elem).attr('value') || '';
        // Replace the HTML entity &quot; with literal quotes, then parse.
        let jsonStr = rawValue.replace(/&quot;/g, '"');
        
        try {
        let data = JSON.parse(jsonStr);

        if (
            data.year === '2023' &&
            data.model.toUpperCase().includes('SIERRA 2500') &&
            data.engine.toUpperCase().includes('6.6L V8')
        ) {
            foundRecord = data.carcode;
            // Break out of the loop since we've found our match
            return false;
        }
        } catch (err) {
        //console.error('Error parsing JSON:', err);
        }
    });

    return foundRecord;
}

(async () => {
  // Launch Puppeteer and open a new page.
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to the starting page.
  await page.goto('http://www.rockauto.com/en/catalog/');
  await page.type('.topsearchinput', '2023 gmc sierra 2500 6.6l v8\n');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ]);

  // After the navigation, retrieve the new URL.
  const newUrl = page.url();
  console.log('New URL:', newUrl);

  // Retrieve the HTML content of the loaded page.
  const htmlContent = await page.content();
  console.log('Page HTML length:', htmlContent.length);

  // Save the HTML content into a file called output.html
  fs.writeFileSync('output.html', htmlContent, 'utf-8');
  console.log('HTML content saved to output.html');

  // Optionally, process the HTML content with a function or parser.
  console.log(extractVehicleData(htmlContent));

  await browser.close();
})();

