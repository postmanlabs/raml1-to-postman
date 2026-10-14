var expect = require('chai').expect,
  fs = require('fs'),
  path = require('path'),
  _ = require('lodash'),
  Ajv = require('ajv-draft-04'),
  Converter = require('../../index.js'),
  VALID_RAML_DIR_PATH = './test/fixtures/valid-raml',
  validateCollection = new Ajv({ strict: false, allErrors: true })
    .compile(require('../fixtures/schemas/collection-v2.1.0.json')),

  // Every kind of typed parameter value (and the falsy ones an `||` chain used to drop)
  TYPED_PARAMS_RAML = [
    '#%RAML 1.0',
    'title: T',
    'baseUri: https://x.test/{region}',
    'baseUriParameters:',
    '  region: { type: integer, default: 2 }',
    '/items/{itemId}:',
    '  uriParameters:',
    '    itemId: { type: integer, example: 42 }',
    '  get:',
    '    headers:',
    '      X-Retries: { type: integer, default: 3, required: true }',
    '    queryParameters:',
    '      page:  { type: integer, default: 1 }',
    '      ratio: { type: number, example: 0.5 }',
    '      zero:  { type: integer, default: 0 }',
    '      flag:  { type: boolean, default: false }',
    '      filter: { type: object, example: { a: 1, b: x } }',
    '      ids: { type: array, items: integer, example: [1, 2] }',
    '      faked: { type: object, properties: { start: integer } }',
    '    responses:',
    '      200:',
    '        headers:',
    '          X-Rate-Limit: { type: integer, example: 100 }',
    '        body:',
    '          application/json:',
    '            example: { ok: true }',
    '/search:',
    '  get:',
    '    queryString:',
    '      type: object',
    '      properties:',
    '        q: { type: string, example: hi }',
    '        limit: { type: integer, example: 3 }',
    '/forms:',
    '  post:',
    '    body:',
    '      application/x-www-form-urlencoded:',
    '        properties:',
    '          n: { type: integer, example: 5 }',
    '  put:',
    '    body:',
    '      multipart/form-data:',
    '        properties:',
    '          f: { type: boolean, example: true }'
  ].join('\n'),

  // The trait from a `uses:` library is what Sync rejected on beta (`page: { default: 1 }`)
  LIBRARY_TRAIT_FILES = {
    '/lib.raml': '#%RAML 1.0 Library\ntraits:\n  paged:\n    queryParameters:\n' +
      '      page: { type: integer, default: 1 }\n      pageSize: { default: 20 }',
    '/api.raml': '#%RAML 1.0\ntitle: T\nbaseUri: https://x.test\nuses:\n  Lib: lib.raml\n' +
      '/things:\n  get:\n    is: [ Lib.paged ]'
  },

  // Fields whose `value` must be a string in Postman Collection v2.1 (`variables` is where path variables land)
  STRING_VALUE_FIELDS = ['variable', 'variables', 'query', 'header', 'urlencoded', 'formdata'];

/**
 * @param {Object} files - map of file name to file content
 * @param {Function} cb - called with the converted collection JSON
 * @returns {void}
 */
function convertFolder (files, cb) {
  Converter.convert({
    type: 'folder',
    data: _.map(files, (content, fileName) => {
      return { fileName: fileName, content: content };
    })
  }, {}, (err, conversionResult) => {
    expect(err).to.be.null;
    expect(conversionResult.result, conversionResult.reason).to.equal(true);
    cb(conversionResult.output[0].data);
  });
}

/**
 * Collects every value in the string-only fields, including inside `response[].originalRequest`
 *
 * @param {Object} collection - collection JSON
 * @returns {Array} list of { where, key, value }
 */
function collectParamValues (collection) {
  var values = [];

  /**
   * @param {*} node - part of the collection
   * @param {String} where - JSON path of node
   * @returns {void}
   */
  function walk (node, where) {
    _.forEach(node, (child, key) => {
      if (_.includes(STRING_VALUE_FIELDS, key) && _.isArray(child)) {
        _.forEach(child, (param, i) => {
          _.has(param, 'value') && values.push({
            where: where + '.' + key + '[' + i + ']',
            key: param.key,
            value: param.value
          });
        });
      }
      _.isObject(child) && walk(child, where + '.' + key);
    });
  }
  walk(collection, '');

  return values;
}

/**
 * @param {Object} collection - collection JSON
 * @returns {Object} the first request of each item, keyed by `METHOD /path`
 */
function requestsByUrl (collection) {
  var requests = {};

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
  collect(collection.item);

  return requests;
}

/**
 * @param {Array} params - list of { key, value } (collection variables are keyed by `id` instead)
 * @param {String} key - param key
 * @returns {String} value of that param, asserted to be a string
 */
function stringValueOf (params, key) {
  var param = _.find(params, (p) => {
    return p.key === key || p.id === key;
  });

  expect(param, key).to.exist;
  expect(typeof param.value, key).to.equal('string');

  return param.value;
}

describe('Parameter, header and variable values are strings (Postman Collection v2.1)', function () {
  it('should emit typed defaults/examples as strings', function (done) {
    convertFolder({ '/api.raml': TYPED_PARAMS_RAML }, (collection) => {
      var item = requestsByUrl(collection)['GET /items/:itemId'],
        request = item.request;

      expect(stringValueOf(collection.variable, 'region')).to.equal('2');
      expect(stringValueOf(request.url.query, 'page')).to.equal('1');
      expect(stringValueOf(request.url.query, 'ratio')).to.equal('0.5');
      expect(stringValueOf(request.url.variables, 'itemId')).to.equal('42');
      expect(stringValueOf(request.header, 'X-Retries')).to.equal('3');
      expect(stringValueOf(item.response[0].header, 'X-Rate-Limit')).to.equal('100');
      done();
    });
  });

  it('should keep falsy defaults instead of replacing them with a placeholder', function (done) {
    convertFolder({ '/api.raml': TYPED_PARAMS_RAML }, (collection) => {
      var query = requestsByUrl(collection)['GET /items/:itemId'].request.url.query;

      expect(stringValueOf(query, 'zero')).to.equal('0');
      expect(stringValueOf(query, 'flag')).to.equal('false');
      done();
    });
  });

  it('should JSON-stringify object and array query parameter values', function (done) {
    convertFolder({ '/api.raml': TYPED_PARAMS_RAML }, (collection) => {
      var query = requestsByUrl(collection)['GET /items/:itemId'].request.url.query;

      expect(stringValueOf(query, 'filter')).to.equal('{"a":1,"b":"x"}');
      expect(stringValueOf(query, 'ids')).to.equal('[1,2]');
      expect(stringValueOf(query, 'faked')).to.equal('{"start":"<integer>"}');
      done();
    });
  });

  it('should emit a library trait\'s numeric query parameter defaults as strings', function (done) {
    convertFolder(LIBRARY_TRAIT_FILES, (collection) => {
      var query = requestsByUrl(collection)['GET /things'].request.url.query;

      expect(stringValueOf(query, 'page')).to.equal('1');
      expect(stringValueOf(query, 'pageSize')).to.equal('20');
      done();
    });
  });

  describe('collections should validate against the Postman Collection v2.1 schema', function () {
    var specs = _.map(_.filter(fs.readdirSync(VALID_RAML_DIR_PATH), (file) => {
      return _.endsWith(file, '.raml');
    }), (file) => {
      return {
        name: file,
        input: { type: 'file', data: path.join(VALID_RAML_DIR_PATH, file) }
      };
    });

    specs.push({
      name: 'ramlSpecFolder (folder input)',
      input: {
        type: 'folder',
        data: _.map(['types/user.raml', 'api.raml'], (file) => {
          var fileName = path.join(VALID_RAML_DIR_PATH, 'ramlSpecFolder', file);

          return { fileName: fileName, content: fs.readFileSync(fileName, 'utf8') };
        })
      }
    });

    _.forEach({
      'typed parameters spec': { '/api.raml': TYPED_PARAMS_RAML },
      'library trait spec': LIBRARY_TRAIT_FILES,
      'library types, includes and JSON Schema spec': {
        '/libs/common.yaml': '#%RAML 1.0 Library\ntypes:\n  Pet:\n    properties:\n      id: integer\n' +
          '    example: { id: 1 }\ntraits:\n  paged:\n    queryParameters:\n' +
          '      limit: { type: integer, default: 20 }\n' +
          'securitySchemes:\n  basic:\n    type: Basic Authentication',
        '/types/summary.yaml': '#%RAML 1.0 DataType\nproperties:\n  name: string\nexample: { name: Bella }',
        '/schemas/pet.json': '{ "type": "object", "properties": { "age": { "type": "integer", "default": 3 } } }',
        '/api.raml': '#%RAML 1.0\ntitle: T\nbaseUri: https://x.test\nuses:\n  Common: libs/common.yaml\n' +
          '/pets:\n  get:\n    is: [ Common.paged ]\n    securedBy: [ Common.basic ]\n    responses:\n      200:\n' +
          '        body:\n          application/json:\n            type: Common.Pet[]\n' +
          '/pets/{id}:\n  get:\n    responses:\n      200:\n        body:\n          application/json:\n' +
          '            type: !include types/summary.yaml\n  put:\n    body:\n      application/json:\n' +
          '        type: !include schemas/pet.json'
      }
    }, (files, name) => {
      specs.push({
        name: name,
        input: {
          type: 'folder',
          data: _.map(files, (content, fileName) => {
            return { fileName: fileName, content: content };
          })
        }
      });
    });

    _.forEach(specs, (spec) => {
      it(spec.name, function (done) {
        Converter.convert(spec.input, {}, (err, conversionResult) => {
          var collection;

          expect(err).to.be.null;
          expect(conversionResult.result, conversionResult.reason).to.equal(true);
          collection = conversionResult.output[0].data;

          expect(validateCollection(collection), JSON.stringify(validateCollection.errors)).to.equal(true);

          // the schema doesn't cover `url.variables`, so check every string-only field directly too
          expect(_.filter(collectParamValues(collection), (param) => {
            return !_.isString(param.value);
          })).to.deep.equal([]);
          done();
        });
      });
    });
  });
});
