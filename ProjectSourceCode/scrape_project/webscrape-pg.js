const cheerio = require('cheerio');

(async () => {
    const url = 'https://www.rockauto.com/en/catalog/honda,2020,civic,1.5l+l4+turbocharged,3445240,belt+drive,belt,8900';
    const response = await fetch(url);

    const $ = cheerio.load(await response.text());
    console.log($.html());
    const title = $('h1').text();
    const text = $('p').text();
    const link = $('a').attr('href');

    console.log(title);
    console.log(text);
    console.log(link);
})();