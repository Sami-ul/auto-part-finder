const cheerio = require('cheerio');
const axios = require('axios');

const partsDict = {
  "headlamp assembly": { parameters: "body+&+lamp+assembly,headlamp+assembly", partNum: "10762" },
  "brake pad": { parameters: "brake+&+wheel+hub,brake+pad", partNum: "1684" },
  "caliper": { parameters: "brake+&+wheel+hub,caliper", partNum: "1704" },
  "rotor": { parameters: "brake+&+wheel+hub,rotor", partNum: "1896" },
  "radiator": { parameters: "cooling+system,radiator", partNum: "2172" },
  "thermostat": { parameters: "cooling+system,thermostat", partNum: "2200" },
  "water pump": { parameters: "cooling+system,water+pump", partNum: "2208" },
  "oil": { parameters: "engine,oil", partNum: "12138" },
  "oil filter": { parameters: "engine,oil+filter", partNum: "5340" },
  "catalytic converter": { parameters: "exhaust+&+emission,catalytic+converter", partNum: "5808" },
  "air filter": { parameters: "fuel+&+air,air+filter", partNum: "6192" },
  "cabin air filter": { parameters: "heat+&+air+conditioning,cabin+air+filter", partNum: "6832" },
  "ignition coil": { parameters: "ignition,ignition+coil", partNum: "7060" },
  "spark plug": { parameters: "ignition,spark+plug", partNum: "7212" },
  "wiper blade": { parameters: "wiper+&+washer,wiper+blade", partNum: "8852" }
};

async function fetchUrl(url) {
  try {
    console.log(`Fetching: ${url}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
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
  $('div.ranavnode input[id^="jsn["]').each((i, elem) => {
    const rawValue = $(elem).attr('value') || '';
    const jsonStr = rawValue.replace(/&quot;/g, '"');
    try {
      const data = JSON.parse(jsonStr);
      if (
        data.make.toLowerCase().includes(make.toLowerCase()) &&
        data.year === year &&
        data.model.toLowerCase().includes(model.toLowerCase()) &&
        data.engine.toLowerCase().includes(engine.toLowerCase())
      ) {
        foundRecord = data.carcode;
        return false;
      }
    } catch (err) { }
  });
  return foundRecord;
}

function getIndexList(html, carcode, partnumber) {
  const $ = cheerio.load(html);

  // Build regex to match an id starting with "navnodeunique[" that contains the carcode and partnumber.
  const idPattern = new RegExp(`^navnodeunique\\[[^\\]]*${carcode}[^\\]]*${partnumber}[^\\]]*\\]$`, 'i');

  // Find the matching input element within a div with class "ranavnode".
  const inputElem = $('div.ranavnode input[type="hidden"]').filter((i, el) => {
    return idPattern.test($(el).attr('id') || "");
  }).first();
  if (!inputElem.length) return null;

  const v = inputElem.attr('value');
  if (!v) return null;

  // Locate the element with id "navchildren[v]".
  const nchildren = $(`#navchildren\\[${v}\\]`);
  if (!nchildren.length) return null;

  // Find the first listings container with an id matching "listings[i]".
  const listingsContainer = nchildren.find('div.listings-container').filter((i, el) => {
    return /^listings\[\d+\]$/.test($(el).attr('id') || "");
  }).first();
  if (!listingsContainer.length) return null;

  // Extract the index i from "listings[i]".
  const iMatch = listingsContainer.attr('id').match(/^listings\[(\d+)\]$/);
  if (!iMatch) return null;
  const iIndex = iMatch[1];

  // Locate the element with id "part_groupindexes_in_this_listing[i]".
  const partGroupElem = listingsContainer.find(`#part_groupindexes_in_this_listing\\[${iIndex}\\]`).first();
  if (!partGroupElem.length) return null;

  const indexListStr = partGroupElem.attr('value');
  if (!indexListStr) return null;

  try {
    return JSON.parse(indexListStr).map(Number);
  } catch (err) {
    return null;
  }
}

function extractProducts(html, carcode, partnumber) {
  const $ = cheerio.load(html);
  const indexList = getIndexList(html, carcode, partnumber);
  if (!indexList) return [];
  
  const products = [];
  
  indexList.forEach(idx => {
    const tbody = $(`tbody[id="listingcontainer[${idx}]"]`).first();
    if (!tbody.length) return;
    const brand = tbody.find('span.listing-final-manufacturer').first().text().trim();
    const partNum = tbody.find('span.listing-final-partnumber').first().text().trim();
    const description = tbody.find('span.span-link-underline-remover').first().text().trim();
    const price = $(`span#dprice\\[${idx}\\]\\[v\\]`).first().text().trim();
    const core  = $(`span#dcore\\[${idx}\\]\\[v\\]`).first().text().trim();
    const pack  = $(`span#dpack\\[${idx}\\]\\[v\\]`).first().text().trim();
    const total = $(`span#dtotal\\[${idx}\\]\\[v\\]`).first().text().trim();
    
    // Extract inline image value and then get image links from the "Slots" array.
    let images = [];
    const inlineImgElem = $(`#jsninlineimg\\[${idx}\\]`).first();
    if (inlineImgElem.length) {
      let rawVal = inlineImgElem.attr('value') || "";
      let imgJSON;
      try {
        imgJSON = JSON.parse(rawVal);
      } catch (e) {
        try {
          imgJSON = JSON.parse(rawVal.replace(/\\/g, ''));
        } catch (err) {
          imgJSON = null;
        }
      }
      if (imgJSON && Array.isArray(imgJSON.Slots)) {
        images = imgJSON.Slots
          .filter(slot => slot.ImageData && slot.ImageData.Full)
          .map(slot => slot.ImageData.Full);
      }
    }
    
    // Extract "Fits" from span.listing-footnote-text within tbody.
    let fits = "N/A";
    const fitsElem = tbody.find('span.listing-footnote-text').first();
    if (fitsElem.length) {
      const text = fitsElem.text().trim();
      if (text) fits = text;
    }
    
    products.push({
      brand,
      partNumber: partNum,
      description,
      price,
      core,
      pack,
      total,
      fits,
      images
    });
  });
  
  return products;
}

async function getParts(data) {
  const make = data.make,
        year = data.year,
        model = data.model,
        engine = data.engine,
        part = data.part;
        
  const carcodeUrl = `https://www.rockauto.com/en/catalog/${make.replace(/ /g, "+")},${year},${model.replace(/ /g, "+")},${engine.replace(/ /g, "+")}`;
  
  let htmlContent = await fetchUrl(carcodeUrl);
  const carcode = getCarCode(htmlContent, make, year, model, engine);
  
  const partUrl = `${carcodeUrl},${carcode},${partsDict[part].parameters},${partsDict[part].partNum}`;
  htmlContent = await fetchUrl(partUrl);
  
  const items = extractProducts(htmlContent, carcode, partsDict[part].partNum);
  console.log(JSON.stringify(items, null, 2));
}

 const data = {
    "make": "gmc",
    "year": "2012",
    "model": "sierra 2500",
    "engine": "6.6l v8 diesel turbocharged",
    "part": "brake pad"
  };

getParts(data);

