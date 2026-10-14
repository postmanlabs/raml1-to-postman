var expect = require('chai').expect,
  _ = require('lodash'),
  Converter = require('../../index.js'),

  PET_LIBRARY = [
    '#%RAML 1.0 Library',
    'types:',
    '  Pet:',
    '    type: object',
    '    properties:',
    '      id: integer',
    '      name: string',
    '      tag?: string',
    '    example: { id: 1, name: Rex, tag: dog }',
    '  Error:',
    '    type: object',
    '    properties:',
    '      code: integer',
    '      message: string',
    'traits:',
    '  paged:',
    '    queryParameters:',
    '      page: { type: integer, default: 1 }',
    '      limit: { type: integer, default: 20 }',
    'securitySchemes:',
    '  basic:',
    '    type: Basic Authentication'
  ].join('\n');

/**
 * Converts in-memory files (as the API Specification Service sends them) and flattens the requests
 *
 * @param {Object} files - map of file name to file content
 * @param {Object} options - converter options
 * @param {Function} cb - called with (conversionResult, requests keyed by `METHOD /path`)
 * @returns {void}
 */
function convertFolder (files, options, cb) {
  var data = _.map(files, (content, fileName) => {
    return { fileName: fileName, content: content };
  });

  Converter.convert({ type: 'folder', data: data }, options, (err, conversionResult) => {
    var requests = {};

    expect(err).to.be.null;

    /**
     * @param {Array} items - collection items
     * @returns {void}
     */
    function collect (items) {
      _.forEach(items, (item) => {
        if (item.item) {
          collect(item.item);
        }
        else {
          requests[item.request.method + ' /' + _.join(item.request.url.path, '/')] = item;
        }
      });
    }

    conversionResult.result && collect(conversionResult.output[0].data.item);
    cb(conversionResult, requests);
  });
}

/**
 * @param {String} body - root RAML content after the title/baseUri header lines
 * @returns {String} root RAML file content
 */
function rootRaml (body) {
  return '#%RAML 1.0\ntitle: Test API\nbaseUri: https://api.test\n' + body;
}

/**
 * @param {String} type - RAML type expression used for a GET /things 200 response body
 * @returns {String} RAML resource snippet
 */
function responseOf (type) {
  return [
    '/things:',
    '  get:',
    '    responses:',
    '      200:',
    '        body:',
    '          application/json:',
    '            type: ' + type
  ].join('\n');
}

/**
 * @param {Object} item - converted collection item
 * @param {String} code - response code
 * @returns {*} parsed response body
 */
function responseBody (item, code) {
  return JSON.parse(_.find(item.response, { code: Number(code) }).body);
}

describe('Multi-file RAML specs (folder input)', function () {
  describe('libraries', function () {
    it('should resolve a library type used as a response body', function (done) {
      convertFolder({
        '/lib.raml': PET_LIBRARY,
        '/api.raml': rootRaml('uses:\n  L: lib.raml\n' + responseOf('L.Pet'))
      }, {}, (result, requests) => {
        expect(result.result).to.equal(true);
        expect(responseBody(requests['GET /things'], 200)).to.deep.equal({ id: 1, name: 'Rex', tag: 'dog' });
        done();
      });
    });

    it('should resolve a type from a library used by another library', function (done) {
      convertFolder({
        '/inner.raml': '#%RAML 1.0 Library\ntypes:\n  Inner:\n    properties:\n      deep: boolean',
        '/outer.raml': '#%RAML 1.0 Library\nuses:\n  N: inner.raml\ntypes:\n  Outer:\n' +
          '    properties:\n      child: N.Inner',
        '/api.raml': rootRaml('uses:\n  L: outer.raml\n' + responseOf('L.Outer'))
      }, {}, (result, requests) => {
        expect(result.result).to.equal(true);
        expect(responseBody(requests['GET /things'], 200)).to.deep.equal({ child: { deep: '<boolean>' } });
        done();
      });
    });

    _.forEach(['yaml', 'json', 'txt'], (extension) => {
      it('should resolve a library saved with a .' + extension + ' extension', function (done) {
        var files = { '/api.raml': rootRaml('uses:\n  L: lib.' + extension + '\n' + responseOf('L.Error')) };

        files['/lib.' + extension] = PET_LIBRARY;
        convertFolder(files, {}, (result, requests) => {
          expect(result.result).to.equal(true);
          expect(responseBody(requests['GET /things'], 200)).to.deep.equal({ code: '<integer>', message: '<string>' });
          done();
        });
      });
    });

    it('should apply a library trait and a library security scheme', function (done) {
      convertFolder({
        '/lib.raml': PET_LIBRARY,
        '/api.raml': rootRaml('uses:\n  L: lib.raml\n/things:\n  get:\n    is: [ L.paged ]\n    securedBy: [ L.basic ]')
      }, {}, (result, requests) => {
        var request = requests['GET /things'].request;

        expect(result.result).to.equal(true);
        // the trait is applied by both expand(true) and the converter; it must still show up only once
        expect(_.map(request.url.query, 'key')).to.deep.equal(['page', 'limit']);
        expect(_.map(request.url.query, 'value')).to.deep.equal([1, 20]);
        expect(request.auth.type).to.equal('basic');
        done();
      });
    });

    it('should resolve library types used in a header and a query parameter', function (done) {
      convertFolder({
        '/lib.raml': '#%RAML 1.0 Library\ntypes:\n  Token:\n    type: string\n    example: abc123\n' +
          '  Count:\n    type: integer\n    example: 7',
        '/api.raml': rootRaml('uses:\n  L: lib.raml\n/things:\n  get:\n    headers:\n      X-Token: L.Token\n' +
          '    queryParameters:\n      count: L.Count')
      }, {}, (result, requests) => {
        var request = requests['GET /things'].request;

        expect(result.result).to.equal(true);
        // same placeholders as a locally declared type gets (type-level examples aren't used for params)
        expect(_.find(request.header, { key: 'X-Token' }).value).to.equal('<string>');
        expect(_.find(request.url.query, { key: 'count' }).value).to.equal('<integer>');
        done();
      });
    });

    it('should resolve a union of library types', function (done) {
      convertFolder({
        '/lib.raml': '#%RAML 1.0 Library\ntypes:\n  A:\n    properties:\n      a: string\n' +
          '  B:\n    properties:\n      b: boolean',
        '/api.raml': rootRaml('uses:\n  L: lib.raml\n' + responseOf('L.A | L.B'))
      }, {}, (result, requests) => {
        expect(result.result).to.equal(true);
        expect(responseBody(requests['GET /things'], 200)).to.deep.equal({ a: '<string>' });
        done();
      });
    });

    it('should fail and name the library when a `uses:` file is missing', function (done) {
      convertFolder({
        '/libs/common.raml': PET_LIBRARY,
        '/api.raml': rootRaml('uses:\n  Common: libs/commons.raml\n' + responseOf('Common.Pet'))
      }, {}, (result) => {
        expect(result.result).to.equal(false);
        expect(result.reason).to.include('Library "Common" (libs/commons.raml) could not be resolved.');
        done();
      });
    });

    it('should resolve a `../` library path from a root file in a subfolder', function (done) {
      convertFolder({
        '/shared/lib.raml': PET_LIBRARY,
        '/specs/api.raml': rootRaml('uses:\n  L: ../shared/lib.raml\n' + responseOf('L.Error'))
      }, {}, (result, requests) => {
        expect(result.result).to.equal(true);
        expect(responseBody(requests['GET /things'], 200)).to.deep.equal({ code: '<integer>', message: '<string>' });
        done();
      });
    });

    it('should resolve libraries and includes relative to a root file in a subfolder', function (done) {
      convertFolder({
        '/specs/libs/lib.raml': PET_LIBRARY,
        '/specs/types/item.raml': '#%RAML 1.0 DataType\nproperties:\n  sku: string',
        '/specs/api.raml': rootRaml('uses:\n  L: libs/lib.raml\n' + responseOf('L.Error') +
          '\n  post:\n    body:\n      application/json:\n        type: !include types/item.raml')
      }, {}, (result, requests) => {
        expect(result.result).to.equal(true);
        expect(responseBody(requests['GET /things'], 200)).to.deep.equal({ code: '<integer>', message: '<string>' });
        expect(JSON.parse(requests['POST /things'].request.body.raw)).to.deep.equal({ sku: '<string>' });
        done();
      });
    });
  });

  describe('types', function () {
    var FRAGMENT = '#%RAML 1.0 DataType\ntype: object\nproperties:\n  id: integer\n  name: string\n' +
      'example: { id: 7, name: Bella }';

    it('should build request and response bodies from a type included directly on the body', function (done) {
      convertFolder({
        '/pet.raml': FRAGMENT,
        '/api.raml': rootRaml(responseOf('!include pet.raml') +
          '\n  post:\n    body:\n      application/json:\n        type: !include pet.raml')
      }, {}, (result, requests) => {
        expect(result.result).to.equal(true);
        expect(responseBody(requests['GET /things'], 200)).to.deep.equal({ id: 7, name: 'Bella' });
        expect(JSON.parse(requests['POST /things'].request.body.raw)).to.deep.equal({ id: 7, name: 'Bella' });
        done();
      });
    });

    it('should prefer a body-level example over the included type\'s example', function (done) {
      convertFolder({
        '/pet.raml': FRAGMENT,
        '/api.raml': rootRaml(responseOf('!include pet.raml') + '\n            example: { id: 9, name: Max }')
      }, {}, (result, requests) => {
        expect(result.result).to.equal(true);
        expect(responseBody(requests['GET /things'], 200)).to.deep.equal({ id: 9, name: 'Max' });
        done();
      });
    });

    it('should generate a body from an included and an inline JSON Schema', function (done) {
      var schema = '{ "$schema": "http://json-schema.org/draft-04/schema#", "type": "object", "properties": ' +
        '{ "name": { "type": "string", "default": "Rex" }, "age": { "type": "integer", "default": 3 } } }';

      convertFolder({
        '/pet.json': schema,
        '/api.raml': rootRaml(responseOf('!include pet.json') +
          '\n  post:\n    body:\n      application/json:\n        type: |\n          ' + schema)
      }, {}, (result, requests) => {
        expect(result.result).to.equal(true);
        expect(responseBody(requests['GET /things'], 200)).to.deep.equal({ name: 'Rex', age: 3 });
        expect(JSON.parse(requests['POST /things'].request.body.raw)).to.deep.equal({ name: 'Rex', age: 3 });
        done();
      });
    });

    it('should fall back to the old behaviour for a type string that starts with `{` but is not JSON',
      function (done) {
        convertFolder({
          '/api.raml': rootRaml(responseOf('|\n              { not: json'))
        }, {}, (result, requests) => {
          expect(result.result).to.equal(true);
          expect(responseBody(requests['GET /things'], 200)).to.be.a('string').that.includes('not: json');
          done();
        });
      });
  });

  describe('urls', function () {
    var GET = '  get:\n    description: d\n',
      cases = [
        { title: '/pets + /pets/{id} at top level', raml: '/pets:\n' + GET + '/pets/{id}:\n' + GET,
          urls: ['GET /pets', 'GET /pets/:id'] },
        { title: '/pets/{id} declared before /pets', raml: '/pets/{id}:\n' + GET + '/pets:\n' + GET,
          urls: ['GET /pets', 'GET /pets/:id'] },
        { title: '/a + /a/b + /a/b/{c}', raml: '/a:\n' + GET + '/a/b:\n' + GET + '/a/b/{c}:\n' + GET,
          urls: ['GET /a', 'GET /a/b', 'GET /a/b/:c'] },
        { title: 'nested /owners -> /{id} -> /pets',
          raml: '/owners:\n' + GET + '  /{id}:\n  ' + GET.replace('\n    ', '\n      ') +
            '    /pets:\n    ' + GET.replace('\n    ', '\n        '),
          urls: ['GET /owners', 'GET /owners/:id', 'GET /owners/:id/pets'] },
        { title: 'root / + /pets', raml: '/:\n' + GET + '/pets:\n' + GET, urls: ['GET /', 'GET /pets'] },
        { title: 'only /pets/{id}', raml: '/pets/{id}:\n' + GET, urls: ['GET /pets/:id'] },
        { title: 'a URI parameter in a parent segment of a top-level resource',
          raml: '/a/{x}/b:\n' + GET + '/a:\n' + GET, urls: ['GET /a', 'GET /a/:x/b'] }
      ];

    _.forEach(cases, (testCase) => {
      _.forEach([true, false], (collapseFolders) => {
        it(testCase.title + ' (collapseFolders: ' + collapseFolders + ')', function (done) {
          convertFolder({ '/api.raml': rootRaml(testCase.raml) }, { collapseFolders }, (result, requests) => {
            expect(result.result).to.equal(true);
            expect(_.keys(requests).sort()).to.deep.equal(testCase.urls.sort());
            done();
          });
        });
      });
    });

    it('should keep the displayName folder name of a top-level /pets/{id}', function (done) {
      convertFolder({
        '/api.raml': rootRaml('/pets:\n' + GET + '/pets/{id}:\n  displayName: Single Pet\n' + GET)
      }, {}, (result, requests) => {
        var folderNames;

        expect(result.result).to.equal(true);
        expect(_.keys(requests).sort()).to.deep.equal(['GET /pets', 'GET /pets/:id']);
        folderNames = _.map(_.flatMap(result.output[0].data.item, 'item'), 'name');
        expect(folderNames).to.include('Single Pet');
        done();
      });
    });
  });
});
