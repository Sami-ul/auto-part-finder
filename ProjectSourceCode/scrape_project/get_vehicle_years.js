const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

makes = ["acura", "alfa romeo", "audi"]
async function fetchCatalogEntry(filename, url) {
  try {
    // Retrieve the HTML content of the Acura catalog page
    const { data } = await axios.get(url);
    
    // Load the HTML into Cheerio (if you need to manipulate or inspect it)
    const $ = cheerio.load(data);
    
    // Save the complete HTML content to a file named 
    fs.writeFileSync(filename, $.html());
    
    console.log(`HTML saved to ${filename}`);
  } catch (error) {
    console.error('Error fetching the page:', error);
  }
}

function parseHTML(filename) {
  // Read the local HTML file (catalog.html) for rockauto.com/en/catalog/
  const html = fs.readFileSync(filename, 'utf8');
  const $ = cheerio.load(html);

  // Select the root div. Escape the square brackets in the id.
  const treeRoot = $('#treeroot\\[catalog\\]');

  // Select only the first 'div.ranavnode' that is not hidden.
  const firstMakeNode = treeRoot.find('div.ranavnode').not('.ra-hide').first();

  if (firstMakeNode.length) {
    // Extract the vehicle make from the first make node.
    const makeAnchor = firstMakeNode.find('table.tbl tbody tr td.nlabel a').first();
    if (!makeAnchor.length) return; // Skip if no anchor found.
    const makeName = makeAnchor.text().trim();

    // Initialize an array to hold the years for this vehicle make.
    let years = [];
    
    // Find the nested years inside a child div with class "nchildren".
    firstMakeNode.find('div.nchildren > div.ranavnode').not('.ra-hide').each((j, yearNode) => {
      const yearAnchor = $(yearNode).find('table.tbl tbody tr td.nlabel a').first();
      if (yearAnchor.length) {
        const yearText = yearAnchor.text().trim();
        if (yearText) {
          years.push(yearText);
        }
      }
    });

    // Output the make and the corresponding years to the console.
    if (years.length) {
      console.log("Vehicle Make: " + makeName);
      console.log("Years: " + (years.length ? years.join(', ') : 'None found'));
      console.log("---------------");
    }
  }
}

let filename = `acura2025.html`;

fetchCatalogEntry(filename, `http://rockauto.com/en/catalog/acura`);
parseHTML(filename);


