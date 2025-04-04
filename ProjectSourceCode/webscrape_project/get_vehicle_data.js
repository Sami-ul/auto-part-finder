const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// List of vehicle makes to scrape
const makes = ["acura", "alfa romeo", "audi"];

// Function to fetch HTML content from a URL
async function fetchCatalogEntry(url) {
  try {
    console.log(`Fetching: ${url}`);
    
    // Add a delay to avoid hitting the server too frequently
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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

// Function to extract years for a make
function extractYears(html) {
  try {
    const $ = cheerio.load(html);
    const years = [];
    
    // Select the root div
    const treeRoot = $('#treeroot\\[catalog\\]');
    
    // Find year nodes
    treeRoot.find('div.ranavnode').not('.ra-hide').each((_, yearNode) => {
      const yearAnchor = $(yearNode).find('table.tbl tbody tr td.nlabel a').first();
      if (yearAnchor.length) {
        const yearText = yearAnchor.text().trim();
        // Make sure it's a valid year (4 digits)
        if (yearText && /^\d{4}$/.test(yearText)) {
          years.push(yearText);
        }
      }
    });
    
    return years;
  } catch (error) {
    console.error('Error extracting years:', error.message);
    return [];
  }
}

// Improved function to extract models for a year
function extractModels(html, make, year) {
  try {
    const $ = cheerio.load(html);
    const models = [];
    const seenModels = new Set(); // To prevent duplicates
    
    // Select the root div
    const treeRoot = $('#treeroot\\[catalog\\]');
    
    // Find model nodes
    treeRoot.find('div.ranavnode').not('.ra-hide').each((_, modelNode) => {
      const modelAnchor = $(modelNode).find('table.tbl tbody tr td.nlabel a').first();
      if (modelAnchor.length) {
        const modelName = modelAnchor.text().trim();
        
        // Skip if the model name is empty, matches the make name, or is a year
        if (!modelName || 
            modelName.toLowerCase() === make.toLowerCase() || 
            modelName === year || 
            /^\d{4}$/.test(modelName)) {
          return;
        }
        
        // Skip duplicates
        if (seenModels.has(modelName)) {
          return;
        }
        
        seenModels.add(modelName);
        models.push(modelName);
      }
    });
    
    return models;
  } catch (error) {
    console.error('Error extracting models:', error.message);
    return [];
  }
}

// Function to extract engine types for a model
function extractEngines(html, make, year, model) {
  try {
    const $ = cheerio.load(html);
    const engines = [];
    const seenEngines = new Set(); // To prevent duplicates
    
    // Select the root div
    const treeRoot = $('#treeroot\\[catalog\\]');
    
    // Find engine nodes
    treeRoot.find('div.ranavnode').not('.ra-hide').each((_, engineNode) => {
      const engineAnchor = $(engineNode).find('table.tbl tbody tr td.nlabel a').first();
      if (engineAnchor.length) {
        const engineName = engineAnchor.text().trim();
        
        // Skip empty engine names
        if (!engineName) {
          return;
        }
        
        // Skip if the engine name matches the make, year, or model
        if (engineName.toLowerCase() === make.toLowerCase() || 
            engineName === year || 
            engineName === model) {
          return;
        }
        
        // Skip if the engine is just a number (likely not an engine type)
        if (/^\d+(\.\d+)?$/.test(engineName)) {
          return;
        }
        
        // Skip duplicates
        if (seenEngines.has(engineName)) {
          return;
        }
        
        // Only include if it looks like an engine type (has typical engine indicators)
        if (isEngineType(engineName)) {
          seenEngines.add(engineName);
          engines.push(engineName);
        }
      }
    });
    
    return engines;
  } catch (error) {
    console.error('Error extracting engines:', error.message);
    return [];
  }
}

// Function to check if a string is likely an engine type
function isEngineType(text) {
  // Common engine type indicators
  const enginePatterns = [
    /L\d+/i,             // L4, L6, etc.
    /V\d+/i,             // V6, V8, etc.
    /ELECTRIC/i,         // Electric engines
    /TURBOCHARGED/i,     // Turbo engines
    /HYBRID/i,           // Hybrid engines
    /CC/i,               // Engine displacement in CC
    /CID/i,              // Engine displacement in CID
    /\d+\.\d+L/i,        // 1.5L, 2.0L, etc.
    /\d+\s*HP/i          // Horsepower rating
  ];
  
  return enginePatterns.some(pattern => pattern.test(text));
}

// Function to handle proper capitalization of vehicle makes and models
function toProperCase(text) {
  // Special cases for known abbreviations
  const specialCases = {
    'mdx': 'MDX',
    'rdx': 'RDX',
    'tlx': 'TLX',
    'ilx': 'ILX',
    'zdx': 'ZDX',
    'tsx': 'TSX',
    'nsx': 'NSX',
    'rlx': 'RLX',
    'rsx': 'RSX',
  };
  
  const lowercaseText = text.toLowerCase();
  
  // Check for special cases first
  if (specialCases[lowercaseText]) {
    return specialCases[lowercaseText];
  }
  
  // Otherwise do normal proper case
  return lowercaseText.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// Main function to scrape the hierarchy for a make
async function scrapeHierarchy() {
  try {
    // Data structure to hold all the results
    const result = {
      makes: []
    };
    
    // For testing, use only the first make
    const testMake = makes[0]; // acura
    console.log(`Testing with make: ${testMake}`);
    
    // Get years for the make
    const makeUrl = `http://rockauto.com/en/catalog/${testMake}`;
    const makeHtml = await fetchCatalogEntry(makeUrl);
    
    if (!makeHtml) {
      console.error(`Failed to fetch data for make: ${testMake}`);
      return result;
    }
    
    const years = extractYears(makeHtml);
    console.log(`Found ${years.length} years for ${testMake}`);
    
    // For testing, use only the first 3 years
    const testYears = years.slice(0, 3);
    console.log(`Testing with years: ${testYears.join(', ')}`);
    
    // Create the make object with proper casing
    const makeData = {
      name: toProperCase(testMake),
      years: []
    };
    
    // Process each test year
    for (const year of testYears) {
      console.log(`Processing year: ${year}`);
      
      // Get models for the year
      const yearUrl = `http://rockauto.com/en/catalog/${testMake},${year}`;
      const yearHtml = await fetchCatalogEntry(yearUrl);
      
      if (!yearHtml) {
        console.error(`Failed to fetch data for year: ${year}`);
        continue;
      }
      
      // Pass make and year to the extractModels function for filtering
      const models = extractModels(yearHtml, testMake, year);
      console.log(`Found ${models.length} models for ${testMake} ${year}`);
      
      // Create the year object
      const yearData = {
        year,
        models: []
      };
      
      // Process each model
      for (const modelName of models) {
        console.log(`Processing model: ${modelName}`);
        
        // Properly format the model for the URL (lowercase, spaces replaced with +)
        const modelUrlParam = modelName.toLowerCase().replace(/\s+/g, '+');
        
        // Get engines for the model
        const modelUrl = `http://rockauto.com/en/catalog/${testMake},${year},${modelUrlParam}`;
        const modelHtml = await fetchCatalogEntry(modelUrl);
        
        if (!modelHtml) {
          console.error(`Failed to fetch data for model: ${modelName}`);
          continue;
        }
        
        // Pass make, year, and model to the extractEngines function for better filtering
        const engines = extractEngines(modelHtml, testMake, year, modelName);
        console.log(`Found ${engines.length} engine types for ${testMake} ${year} ${modelName}`);
        
        // Create the model object if it has engines
        if (engines.length > 0) {
          yearData.models.push({
            name: toProperCase(modelName),
            engines
          });
        }
      }
      
      // Add the year to the make if it has models
      if (yearData.models.length > 0) {
        makeData.years.push(yearData);
      }
    }
    
    // Add the make to the result
    result.makes.push(makeData);
    
    // Save the result to a JSON file
    fs.writeFileSync('rockauto_hierarchy_test.json', JSON.stringify(result, null, 2));
    console.log('Results saved to rockauto_hierarchy_test.json');
    
    return result;
  } catch (error) {
    console.error('Error scraping hierarchy:', error.message);
    return { makes: [] };
  }
}

// Run the scraper
scrapeHierarchy()
  .then(result => {
    console.log('Scraping completed!');
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });