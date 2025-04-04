const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const url = 'https://www.rockauto.com/en/catalog/acura,2025';

async function fetchAndSaveAcuraCatalog() {
  try {
    // Retrieve the HTML content of the Acura catalog page
    const { data } = await axios.get(url);
    
    // Load the HTML into Cheerio (if you need to manipulate or inspect it)
    const $ = cheerio.load(data);
    
    // Save the complete HTML content to a file named "acura.html"
    fs.writeFileSync('acura2025.html', $.html());
    
    console.log('Acura catalog HTML has been saved to acura.html');
  } catch (error) {
    console.error('Error fetching the page:', error);
  }
}

fetchAndSaveAcuraCatalog();


