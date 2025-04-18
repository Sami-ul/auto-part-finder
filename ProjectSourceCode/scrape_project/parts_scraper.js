const cheerio = require("cheerio");
const puppeteer = require("puppeteer");


const partsDict = {
  battery: { parameters: "electrical,battery,battery", partNum: "2476" },
  ignition: { parameters: "ignition,ignition+coil+/+wiring,ignition+coil", partNum: "7060" },
  "headlamp assembly": { parameters: "body+&+lamp+assembly,headlamp+assembly", partNum: "10762" },
  speaker: { parameters: "interior,radio+/+speaker,speaker", partNum: "1319" },

};

function getIndexList(html, partNum) {
  const $ = cheerio.load(html);
  const idPat = new RegExp(`^navnodeunique\\[[^\\]]*${partNum}\\]$`, "i");
  const v = $('div.ranavnode input[type="hidden"]')
    .filter((_, el) => idPat.test($(el).attr("id") || ""))
    .first()
    .attr("value");
  if (!v) return null;
  const listId = $(`#navchildren\\[${v}\\]`)
    .find("div.listings-container")
    .filter((_, el) => /^listings\[\d+\]$/.test($(el).attr("id") || ""))
    .first()
    .attr("id")
    .match(/\[(\d+)\]/)[1];
  const str = $(`#part_groupindexes_in_this_listing\\[${listId}\\]`).attr("value");
  return str ? JSON.parse(str).map(Number) : null;
}

function parseVehicleTable(html) {
  const $ = cheerio.load(html);
  const results = [];

  $("table tbody tr").each((_, tr) => {
    const cols = $(tr)
      .find("td")
      .map((_, td) => $(td).text().trim())
      .get();
    if (cols.length === 2) {
      const [make, yrs] = cols;
      const [f, t] = yrs.split(/[-–]/).map(x => parseInt(x, 10));
      results.push({
        make,
        fromYear: f,
        toYear: isNaN(t) ? f : t
      });
    } else if (cols.length === 3) {
      const [make, model, yrs] = cols;
      const [f, t] = yrs.split(/[-–]/).map(x => parseInt(x, 10));
      results.push({
        make,
        model,
        fromYear: f,
        toYear: isNaN(t) ? f : t
      });
    }
  });
  return results;
}

async function extractProducts(page, partNum) {
  const html = await page.content();
  const $ = cheerio.load(html);
  const idxList = getIndexList(html, partNum);
  if (!idxList) return [];
  const products = [];

  for (const idx of idxList) {
    const rowSel = `tbody#listingcontainer\\[${idx}\\]`;
    // ensure the row is in the DOM
    await page.waitForSelector(rowSel, { visible: true, timeout: 5000 });

    // scrape static fields via Cheerio on the raw HTML
    const tbody = $(rowSel).first();
    const brand       = tbody.find("span.listing-final-manufacturer").text().trim();
    const partNumber  = tbody.find("span.listing-final-partnumber").text().trim();
    const description = tbody.find("span.span-link-underline-remover").first().text().trim();
    let infolink      = tbody.find("span.span-link-underline-remover").next().attr("href");
    infolink = infolink ? infolink.trim() : "N/A";
    const price       = $(`span#dprice\\[${idx}\\]\\[v\\]`).text().trim();
    const core        = $(`span#dcore\\[${idx}\\]\\[v\\]`).text().trim();
    const pack        = $(`span#dpack\\[${idx}\\]\\[v\\]`).text().trim();
    const total       = $(`span#dtotal\\[${idx}\\]\\[v\\]`).text().trim();

    // click the part-number link scoped to this row
    const btnSel = `${rowSel} span.listing-final-partnumber`;
    await page.waitForSelector(btnSel, { visible: true, timeout: 5000 });
    await page.click(btnSel);
    await new Promise(r => setTimeout(r, 500));

    // now wait for and scrape the popup
    await page.waitForSelector("#buyersguidepopup-outer_c", { timeout: 5000 });
    const popupHtml = await page.$eval("#buyersguidepopup-outer_c", el => el.innerHTML);
    const $pop = cheerio.load(popupHtml);
    let vehicles = [];
    if ($pop('div#buyersguidepopup-outer_b').text().trim() !== 'No applications found.') {
      vehicles = parseVehicleTable(popupHtml);
    }
    // close the popup
    await page.click("#buyersguidepopup-outer_c .dialog-close");


    // images and fits as before…
    const inline = $(`#jsninlineimg\\[${idx}\\]`).attr("value") || "";
    let slots = [];
    try {
      slots = JSON.parse(inline).Slots || [];
    } catch {
      try { slots = JSON.parse(inline.replace(/\\/g, "")).Slots || []; }
      catch { slots = []; }
    }
    const imagesFull  = slots.filter(s => s.ImageData?.Full).map(s => `https://www.rockauto.com${s.ImageData.Full}`);
    const imagesThumb = slots.filter(s => s.ImageData?.Thumb).map(s => `https://www.rockauto.com${s.ImageData.Thumb}`);
    const fits        = tbody.find("span.listing-footnote-text").text().trim() || "N/A";

    products.push({ brand, partNumber, description, price, core, pack, total, fits, imagesFull, imagesThumb, infolink, vehicles });
  }

  return products;
}

async function getParts(part) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setUserAgent(/* same UA */);
  const url = `https://www.rockauto.com/en/tools/${partsDict[part].parameters},${partsDict[part].partNum}`;
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.waitForSelector("span.listing-final-partnumber", { visible: true, timeout: 10000 });
  const products = await extractProducts(page, partsDict[part].partNum);
  await browser.close();
  return products;
}

module.exports = { getParts };




