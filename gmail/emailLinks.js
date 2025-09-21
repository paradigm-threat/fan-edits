require('dotenv').config({ path: '../.env.local'});

const {movies} = require('./links.json');
const dataArray = Object.keys(movies).map(movie => {
  return `[${movie}](mailto:ari@asu.edu?subject=${encodeURI(`Request: ${movie}`)})`;
});
console.log(dataArray.join('\n'));