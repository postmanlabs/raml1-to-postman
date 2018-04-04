const converter = require('../convert.js'),
  fs = require('fs');

const ramlData = `#%RAML 1.0
title: GitHub API
version: v3
baseUri: https://api.github.com/{version}
/users:
  get:
    description: Get a list of users
    queryParameters:
      page:
        description: Specify the page that you want to retrieve
        type:        integer
        required:    true
        example:     1
      per_page:
        description: Specify the amount of items that will be retrieved per page
        type:        integer
        minimum:     10
        maximum:     200
        default:     30
        example:     50
`;

fs.writeFileSync('collection-file.json', JSON.stringify(converter.convert(ramlData).toJSON(), null, 2));

//console.log(JSON.stringify(converter.convert(ramlData).toJSON(), null, 2));
console.log(converter.validate(ramlData));
