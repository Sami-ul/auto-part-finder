const { getParts } = require('./parts_scraper');

(async () => {
  try {
    console.log('Retrieving battery fitment data...');
    const parts = await getParts('battery');
    console.log('Results for "battery":');
    console.log(JSON.stringify(parts, null, 2));
  } catch (err) {
    console.error('Error retrieving battery parts:', err);
  }
})();