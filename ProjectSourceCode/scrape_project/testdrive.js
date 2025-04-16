import { getParts } from './get_parts.js';

const data1 = {
    "make": "subaru",
    "year": "1997",
    "model": "impreza",
    "engine": "1.8l h4",
    "part": "wiper blade"
  };

  const data2 = {
    "make": "honda",
    "year": "2020",
    "model": "cr-v",
    "engine": "1.5l l4 turbocharged",
    "part": "brake pad"
  };

  const data3 = {
    "make": "gmc",
    "year": "2012",
    "model": "sierra 2500",
    "engine": "6.6l v8 diesel turbocharged",
    "part": "oil"
  };
let results1 = await getParts(data1);
let results2 = await getParts(data2);
let results3 = await getParts(data3);
console.log(`Results1 length is: ${results1.length}`);
console.log(results1[0]);
console.log(`\nResults2 length is: ${results2.length}`);
console.log(results2[0]);
console.log(`\nResults3 length is: ${results3.length}`);
console.log(results3[0]);
