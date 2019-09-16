const expect = require('chai').expect,
  converter = require('./../../lib/convert.js'),
  fs = require('fs'),
  _ = require('lodash');

/**
* Used to remove property id of a json object
*
* @param {object} obj - collection object
*
*/
function removeId (obj) {
  _.has(obj, 'id') && delete obj.id;

  for (var item in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, item)) {
      typeof obj[item] === 'object' && removeId(obj[item]);
    }
  }
}

/* global describe, it */
describe('Converter Integration tests', function() {

  it('should convert basic raml spec to postman collection' +
      'with proper headers, body, responses and security schemes', function() {
    let ramlString = fs.readFileSync('./../fixtures/ramlSpecBasic.raml').toString(),
      collectionJSON = converter.convert(ramlString).toJSON(),
      collectionFixture = JSON.parse(fs.readFileSync('./../fixtures/ramlSpecBasicCollection.json').toString());

    removeId(collectionJSON);
    expect(collectionJSON).to.be.an('object');
    expect(collectionJSON).to.deep.equal(collectionFixture);
  });

  it('should convert raml spec with raml types being used' +
      'in headers, body, query parameters and uri parameters', function() {
    let ramlString = fs.readFileSync('./../fixtures/ramlSpecTypes.raml').toString(),
      collectionJSON = converter.convert(ramlString).toJSON(),
      collectionFixture = JSON.parse(fs.readFileSync('./../fixtures/ramlSpecTypesCollection.json').toString());

    removeId(collectionJSON);
    expect(collectionJSON).to.be.an('object');
    expect(collectionJSON).to.deep.equal(collectionFixture);
  });
});
