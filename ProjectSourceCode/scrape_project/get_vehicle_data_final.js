const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// List of vehicle makes to scrape
const makes = ["acura", "alfa romeo", "audi", "bmw", "buick", "cadillac", "chevrolet", "chrysler", "dodge", "fiat", "ford", "geo", "gmc", "honda", "hummer",
               "hyundai", "infiniti", "isuzu", "jaguar", "jeep", "kia", "land rover", "lexus", "lincoln", "mazda", "mercedes-benz", "mercury", "mini",
               "mitsubishi", "nissan", "oldsmobile", "plymouth", "pontiac", "porsche", "ram", "saab", "saturn", "scion", "subaru", "suzuki", "toyota",
               "volkswagen", "volvo"];

// Function to fetch HTML content from a URL
async function fetchCatalogEntry(url) {
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
            modelName === year ) {
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
    'bmw': 'BMW',
    'gmc': 'GMC',
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

// Function to convert JSON data to CSV format
function convertToCSV(data) {
  // Define CSV header
  let csv = 'Make,Year,Model,Engine\n';
  
  // Process each make
  data.makes.forEach(make => {
    // Process each year for this make
    make.years.forEach(year => {
      // Process each model for this year
      year.models.forEach(model => {
        // Process each engine for this model
        model.engines.forEach(engine => {
          // Escape fields that might contain commas
          const escapedMake = `"${make.name.replace(/"/g, '""')}"`;
          const escapedModel = `"${model.name.replace(/"/g, '""')}"`;
          const escapedEngine = `"${engine.replace(/"/g, '""')}"`;
          
          // Add row to CSV
          csv += `${escapedMake},${year.year},${escapedModel},${escapedEngine}\n`;
        });
      });
    });
  });
  
  return csv;
}

// Function to save progress
function saveProgress(data, makeIndex, yearIndex) {
  // Save the current data to JSON
  fs.writeFileSync('vehicle_data_progress.json', JSON.stringify(data, null, 2));
  
  // Save progress tracking info
  fs.writeFileSync('scraper_progress.json', JSON.stringify({
    makeIndex,
    yearIndex,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  // Convert and save CSV
  const csv = convertToCSV(data);
  fs.writeFileSync('vehicle_data_progress.csv', csv);
  
  console.log(`Progress saved. Current make: ${makeIndex}, current year: ${yearIndex}`);
}

// Main function to scrape all vehicle makes and their years, models, and engines
async function scrapeAllMakes() {
  try {
    console.log('Starting full vehicle data extraction...');
    
    // Data structure to hold all results
    const result = {
      makes: []
    };
    
    // Check for progress file to resume from
    let startMakeIndex = 0;
    let startYearIndex = 0;
    
    if (fs.existsSync('scraper_progress.json')) {
      try {
        const progress = JSON.parse(fs.readFileSync('scraper_progress.json', 'utf8'));
        startMakeIndex = progress.makeIndex || 0;
        startYearIndex = progress.yearIndex || 0;
        console.log(`Resuming from make ${startMakeIndex} (${makes[startMakeIndex]}), year index ${startYearIndex}`);
        
        // Load previous data if available
        if (fs.existsSync('vehicle_data_progress.json')) {
          const progressData = JSON.parse(fs.readFileSync('vehicle_data_progress.json', 'utf8'));
          result.makes = progressData.makes || [];
          console.log(`Loaded ${result.makes.length} makes from previous progress`);
        }
      } catch (err) {
        console.error('Error reading progress file:', err.message);
        console.log('Starting from the beginning');
      }
    }
    
    // Process each make starting from where we left off
    for (let i = startMakeIndex; i < makes.length; i++) {
      const make = makes[i];
      console.log(`\nProcessing make ${i+1}/${makes.length}: ${make}`);
      
      // Get years for the make
      const makeUrl = `http://rockauto.com/en/catalog/${make}`;
      const makeHtml = await fetchCatalogEntry(makeUrl);
      
      if (!makeHtml) {
        console.error(`Failed to fetch data for make: ${make}`);
        //continue;
        process.exit();;
      }
      
      const years = extractYears(makeHtml);
      console.log(`Found ${years.length} years for ${make}`);
      
      // Sort years in descending order (newest first)
      years.sort((a, b) => parseInt(b) - parseInt(a));
      
      // Create the make object
      let makeData = result.makes.find(m => m.name.toLowerCase() === toProperCase(make).toLowerCase());
      if (!makeData) {
        makeData = {
          name: toProperCase(make),
          years: []
        };
        result.makes.push(makeData);
      }
      
      // Process each year for this make, starting from where we left off
      const startYearIdx = i === startMakeIndex ? startYearIndex : 0;
      for (let j = startYearIdx; j < years.length; j++) {
        const year = years[j];
        console.log(`Processing year ${j+1}/${years.length}: ${year}`);
        
        // Save progress regularly
        saveProgress(result, i, j);
        
        // Get models for the year
        const yearUrl = `http://rockauto.com/en/catalog/${make},${year}`;
        const yearHtml = await fetchCatalogEntry(yearUrl);
        
        if (!yearHtml) {
          console.error(`Failed to fetch data for year: ${year}`);
          // continue;
          process.exit();
        }
        
        const models = extractModels(yearHtml, make, year);
        console.log(`Found ${models.length} models for ${make} ${year}`);
        
        // Create the year object if it doesn't exist already
        let yearData = makeData.years.find(y => y.year === year);
        if (!yearData) {
          yearData = {
            year,
            models: []
          };
          makeData.years.push(yearData);
        }
        
        // Process each model
        for (const modelName of models) {
          console.log(`Processing model: ${modelName}`);
          
          // Skip if this model already exists for this year
          if (yearData.models.some(m => m.name.toLowerCase() === toProperCase(modelName).toLowerCase())) {
            console.log(`Model ${modelName} already processed. Skipping.`);
            continue;
          }
          
          // Properly format the model for the URL
          const modelUrlParam = modelName.toLowerCase().replace(/\s+/g, '+');
          
          // Get engines for the model
          const modelUrl = `http://rockauto.com/en/catalog/${make},${year},${modelUrlParam}`;
          const modelHtml = await fetchCatalogEntry(modelUrl);
          
          if (!modelHtml) {
            console.error(`Failed to fetch data for model: ${modelName}`);
            // continue;
            process.exit();;
          }
          
          const engines = extractEngines(modelHtml, make, year, modelName);
          console.log(`Found ${engines.length} engine types for ${make} ${year} ${modelName}`);
          
          // Add model to year if it has engines
          if (engines.length > 0) {
            yearData.models.push({
              name: toProperCase(modelName),
              engines
            });
            
            // Save progress after each model
            saveProgress(result, i, j);
          }
        }
      }
    }
    
    // Save final result
    fs.writeFileSync('rockauto_vehicle_data.json', JSON.stringify(result, null, 2));
    
    // Convert to CSV and save
    const csv = convertToCSV(result);
    fs.writeFileSync('rockauto_vehicle_data.csv', csv);
    
    console.log('\nVehicle data extraction completed!');
    console.log(`Total makes processed: ${result.makes.length}`);
    console.log('Results saved to rockauto_vehicle_data.json and rockauto_vehicle_data.csv');
    
    return result;
  } catch (error) {
    console.error('Error scraping vehicle data:', error.message);
    return { makes: [] };
  }
}

// Run the full scraper
scrapeAllMakes()
  .then(result => {
    console.log('Scraping completed!');
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });