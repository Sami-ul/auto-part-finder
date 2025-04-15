const cheerio = require('cheerio');
const fs = require('fs');
const puppeteer = require('puppeteer');
const axios = require('axios');

const partsDict = {
  "headlamp assembly" : "body+&+lamp+assembly,headlamp+assembly,10762",
  "brake pad" : "brake+&+wheel+hub,brake+pad,1684",
  "caliper" : "brake+&+wheel+hub,caliper,1704",
  "rotor" : "brake+&+wheel+hub,rotor,1896",
  "radiator" : "cooling+system,radiator,2172",
  "thermostat" : "cooling+system,thermostat,2200",
  "water pump" : "cooling+system,water+pump,2208",
  "oil" : "engine,oil,12138",
  "oil filter" : "engine,oil+filter,5340",
  "catalytic converter" : "exhaust+&+emission,catalytic+converter,5808",
  "air filter" : "fuel+&+air,air+filter,6192",
  "cabin air filter" : "heat+&+air+conditioning,cabin+air+filter,6832",
  "ignition coil" : "ignition,ignition+coil,7060",
  "spark plug" : "ignition,spark+plug,7212",
  "wiper blade" : "wiper+&+washer,wiper+blade,8852",
};

async function fetchUrl(url) {
  try {
    console.log(`Fetching: ${url}`);
    
    // Add a delay to avoid hitting the server too frequently
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Fetch the HTML content
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching the page:', error.message);
    return null;
  }
}

function getCarCode(html, make, year, model, engine) {
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
            data.make.toLowerCase().includes(make.toLowerCase()) &&
            data.year === year &&
            data.model.toLowerCase().includes(model.toLowerCase()) &&
            data.engine.toLowerCase().includes(engine.toLowerCase())
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

function extractProducts(html) {
  const $ = cheerio.load(html);
  const products = [];
  let index = 8; // starting index (as indicated by your clues)

  // Loop while an image with id "inlineimg[index]" exists.
  while (true) {
    // Use an attribute filtering function to match the id exactly.
    const imgElem = $('img').filter((i, el) => {
      return $(el).attr('id') === `inlineimg[${index}]`;
    }).first();

    if (!imgElem.length) {
      // No more product cells found; end the loop.
      break;
    }
    
    // The product cell container is assumed to be the closest ancestor
    // with class "listing-container-border"
    const cell = imgElem.closest('.listing-container-border');
    if (!cell.length) {
      index++;
      continue;
    }
    
    // Extract BRAND, PART NUMBER, and DESCRIPTION.
    const brand = cell.find('span.listing-final-manufacturer').first().text().trim();
    const partNumber = cell.find('span.listing-final-partnumber').first().text().trim();
    const description = cell.find('span.span-link-underline-remover').first().text().trim();
    
    // Extract PRICE:
    // Prefer the TOTAL price from the element with id "dtotal[INDEX][v]".
    const totalPrice = $(`span`).filter((i, el) => {
      return $(el).attr('id') === `dtotal[${index}][v]`;
    }).first().text().trim();
    
    // Fallback: the PRICE from element with id "dprice[INDEX][v]".
    const priceEach = $(`span`).filter((i, el) => {
      return $(el).attr('id') === `dprice[${index}][v]`;
    }).first().text().trim();
    const price = totalPrice || priceEach;
    
    // Process the thumbnail image.
    let thumbnail = imgElem.attr('src') || "";
    if (thumbnail.startsWith('/')) {
      thumbnail = 'https://www.rockauto.com' + thumbnail;
    }
    // Remove the extraneous marker (e.g., "__ra_m") from the filename.
    thumbnail = thumbnail.replace(/__ra_m(?=\.jpg)/i, '');
    
    // Only add the product if essential data is found.
    if (brand && partNumber && description) {
      products.push({
        brand,
        partNumber,
        description,
        price,
        thumbnail
      });
    }
    
    index++; // Proceed to the next product cell.
  }
  
  return products;
}

(async () => {
  make = 'honda';
  year = '2020';
  model = 'cr-v';
  engine = '1.5l l4 turbocharged';
  part = 'oil';

  carcodeUrl = `https://www.rockauto.com/en/catalog/${make.replace(/ /g, "+")},${year},${model.replace(/ /g, "+")},${engine.replace(/ /g, "+")}`;
  htmlContent = await fetchUrl(carcodeUrl)
  carcode = getCarCode(htmlContent, make, year, model, engine);
  partUrl = carcodeUrl + `,${carcode},${partsDict[part]}`;
  console.log(partUrl);
  htmlContent = await fetchUrl(partUrl)
  fs.writeFileSync('output.html', htmlContent, 'utf8');
  console.log('HTML output saved to output.html');
  const items = extractProducts(htmlContent);
  console.log(JSON.stringify(items, null, 2));
})();

