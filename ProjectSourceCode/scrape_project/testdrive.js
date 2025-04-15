const { getParts } = require('./get_parts');

(async () => {
  const data = {
    "make": "gmc",
    "year": "2012",
    "model": "sierra 2500",
    "engine": "6.6l v8 diesel turbocharged",
    "part": "brake pad"
  };

  const results = await getParts(data);
  console.log(`Length results: ${results.length}`);
  console.log(results[0]);
})();