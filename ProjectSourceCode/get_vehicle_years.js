const fs = require('fs');
const cheerio = require('cheerio');

// Read the local HTML file (catalog.html) for rockauto.com/en/catalog/
const html = fs.readFileSync('acura.html', 'utf8');
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


