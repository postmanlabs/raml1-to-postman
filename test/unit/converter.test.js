const expect = require('chai').expect,
  fs = require('fs'),
  _ = require('lodash'),
  Ajv = require('ajv-draft-04'),
  converter = require('../../index'),
  helper = require('./../../lib/helper.js'),
  { Collection } = require('postman-collection/lib/collection/collection'),
  { Header } = require('postman-collection/lib/collection/header'),
  VALID_RAML_DIR_PATH = './test/fixtures/valid-raml',
  INVALID_VERSION_PATH = './test/fixtures/invalid-raml/invalidVersion.raml',
  validateCollection = new Ajv({ strict: false, allErrors: true })
    .compile(require('../fixtures/schemas/collection-v2.1.0.json'));

/**
 * @param {Object} input - converter input
 * @param {Object} options - converter options
 * @param {Function} cb - called with the schema-valid collection JSON and its requests keyed by `METHOD /path`
 * @returns {void}
 */
function convertToRequests (input, options, cb) {
  converter.convert(input, options, (err, conversionResult) => {
    let collection,
      requests = {};

    expect(err).to.be.null;
    expect(conversionResult.result, conversionResult.reason).to.equal(true);
    collection = conversionResult.output[0].data;
    expect(validateCollection(collection), JSON.stringify(validateCollection.errors)).to.equal(true);
    expect(JSON.stringify(collection)).to.not.include('"type":null');

    (function collect (items) {
      _.forEach(items, (item) => {
        item.item ? collect(item.item) :
          (requests[item.request.method + ' /' + _.join(item.request.url.path, '/')] = item.request);
      });
    }(collection.item));

    cb(collection, requests);
  });
}

/**
 * @param {String} fileName - fixture under valid-raml
 * @returns {Object} converter input
 */
function fixture (fileName) {
  return { type: 'file', data: VALID_RAML_DIR_PATH + '/' + fileName };
}

/* global describe, it */
describe('Validate raml', function() {
  it('should validate valid raml string', function() {
    let ramlString = fs.readFileSync(VALID_RAML_DIR_PATH + '/validRaml.raml').toString(),
      valid = converter.validate({
        type: 'string',
        data: ramlString
      });

    expect(valid.result).to.be.equal(true);
  });

  it('should validate folder with valid root of document', function() {
    let valid = converter.validate({
      type: 'folder',
      data: [
        { fileName: VALID_RAML_DIR_PATH + '/ramlSpecFolder/types/user.raml' },
        { fileName: VALID_RAML_DIR_PATH + '/ramlSpecFolder/api.raml' }
      ]
    });

    expect(valid.result).to.be.equal(true);
  });

  describe('should not validate invalid raml string', function() {
    it('with invalid version', function() {
      let ramlString = fs.readFileSync(INVALID_VERSION_PATH).toString(),
        valid = converter.validate({
          type: 'string',
          data: ramlString
        });

      expect(valid.result).to.be.equal(false);
    });
  });
});

describe('helper functions', function() {
  it('should convert raml header into postman header', function() {
    let ramlHeader = {
        name: 'UserID',
        displayName: 'UserID',
        typePropertyKind: 'TYPE_EXPRESSION',
        type: ['uid'],
        required: true,
        description: 'the identifier for the user that posts a new organisation',
        __METADATA__: { primitiveValuesMeta: { displayName: [Object], required: [Object] } },
        structuredExample: {
          value: 'SWED-123',
          strict: true,
          name: null,
          structuredValue: 'SWED-123'
        }
      },
      types = {
        'uid': {
          'type': [
            'string'
          ],
          'example': 'SWED-123'
        }
      },
      postmanHeader = helper.convertHeader(ramlHeader, types, 'example');

    expect(postmanHeader).to.be.an('object');
    expect(postmanHeader.key).to.equal('UserID');
    expect(postmanHeader.value).to.equal('SWED-123');
    expect(postmanHeader.description).to.equal('the identifier for the user that posts a new organisation');
  });

  describe('Should convert url path variables of request', function() {
    it('of (type: string)', function() {
      let baseUrl = '{{baseUrl}}/hello/{param}',
        params = {
          param: {
            name: 'param',
            displayName: 'param',
            typePropertyKind: 'TYPE_EXPRESSION',
            type: ['string'],
            default: 'userId',
            required: true,
            __METADATA__: { calculated: true, primitiveValuesMeta: [Object] }
          }
        },
        convertedUrlAndVars = helper.addParametersToUrl(baseUrl, params);

      expect(convertedUrlAndVars.url).to.be.a('string');
      expect(convertedUrlAndVars.url).to.equal('{{baseUrl}}/hello/:param');
      expect(convertedUrlAndVars.variables).to.be.an('array');
      expect(convertedUrlAndVars.variables[0].value).to.equal('userId');
    });

    it('of (type: object)', function() {
      let baseUrl = '{{baseUrl}}/hello/{param}',
        params = {
          param: {
            name: 'param',
            displayName: 'param',
            typePropertyKind: 'TYPE_EXPRESSION',
            type: ['object'],
            required: true,
            __METADATA__: { calculated: true, primitiveValuesMeta: [Object] }
          }
        },
        types = {
          object: {}
        },
        convertedUrlAndVars = helper.addParametersToUrl(baseUrl, params, types);

      expect(convertedUrlAndVars.url).to.be.a('string');
      expect(convertedUrlAndVars.url).to.equal('{{baseUrl}}/hello/:param');
    });
  });

  it('should set info for collection', function() {
    let info = {
        title: 'My sample api',
        description: 'This is the description.',
        version: '1.1'
      },
      collection = new Collection(),
      modified_collection = helper.setCollectionInfo(info, collection);

    expect(modified_collection.name).to.equal('My sample api');
    expect(modified_collection.version).to.equal('1.1');
    expect(modified_collection.description).to.equal('This is the description.');
  });

  it('should convert RAML documentation to postman description', function() {
    let documentation = [{
        title: 'Home',
        content: 'This does support **Markdown**'
      }],
      description = 'This is the description.',
      convertedDescription = helper.convertDescription(description, documentation);

    expect(convertedDescription).to.equal('# Description\n\nThis is the description.\n\n' +
      '# Documentation\n\n## Home\n\nThis does support **Markdown**\n\n');
  });

  it('should add query parameters to url', function() {
    let queryParams = {
        page: {
          name: 'page',
          displayName: 'page',
          description: 'sample description',
          type: ['page']
        },
        per_page: {
          name: 'per_page',
          displayName: 'per_page',
          type: ['integer'],
          example: 10
        }
      },
      types = {
        'page': {
          'type': [
            'object'
          ],
          'properties': {
            'start': {
              'name': 'start',
              'type': [
                'integer'
              ]
            },
            'page_size': {
              'name': 'page_size',
              'type': [
                'integer'
              ]
            }
          }
        }
      },
      expectedQueryParams = [
        {
          key: 'page',
          value: '{\"start\":\"<integer>\",\"page_size\":\"<integer>\"}',
          description: 'sample description'
        },
        {
          key: 'per_page',
          value: '10'
        }
      ],
      convertedQueryParams = helper.constructQueryStringFromQueryParams(queryParams, types);

    expect(convertedQueryParams).to.deep.equal(expectedQueryParams);
  });

  it('should construct query string', function() {
    let queryString = {
        'name': 'queryString',
        'type': [
          'madeuptype'
        ]
      },
      types = {
        'madeuptype': {
          'type': [
            'object'
          ],
          'properties': {
            'page': {
              'name': 'page',
              'type': [
                'integer'
              ]
            },
            'per_page': {
              'name': 'per_page',
              'type': [
                'integer'
              ]
            }
          }
        }
      },
      expectedQueryParams = [
        {
          key: 'page',
          value: '<integer>'
        },
        {
          key: 'per_page',
          value: '<integer>'
        }
      ],
      convertedQueryParams = helper.constructQueryString(queryString, types);

    expect(convertedQueryParams).to.deep.equal(expectedQueryParams);
  });

  it('should disable optional headers', function() {
    let ramlHeader = {
        name: 'UserID',
        displayName: 'UserID',
        type: ['string'],
        example: 'SWED-123',
        required: false
      },
      types = {},
      postmanHeader = helper.convertHeader(ramlHeader, types, 'schema');

    expect(Header.isHeader(postmanHeader)).to.be.true;
    expect(postmanHeader.disabled).to.be.true;
  });

  it('should generate postman security schemes', function() {
    let securedBy = 'oauth_1_0',
      securitySchemes = {
        basic:
         {
           name: 'basic',
           type: 'Basic Authentication',
           description: 'This is basic security scheme'
         },
        digest:
         {
           name: 'digest',
           type: 'Digest Authentication',
           description: 'This is a digest security scheme'
         },
        oauth_1_0:
          {
            name: 'oauth_1_0',
            type: 'OAuth 1.0',
            description: 'OAuth 1.0 continues to be supported for all API requests\n',
            settings:
            {
              requestTokenUri: 'https://api.mysampleapi.com/1/oauth/request_token',
              authorizationUri: 'https://api.mysampleapi.com/1/oauth/authorize',
              tokenCredentialsUri: 'https://api.mysampleapi.com/1/oauth/access_token',
              signatures: [Object]
            }
          }
      },
      postmanSecurityScheme = helper.convertSecurityScheme(securedBy, securitySchemes);

    expect(postmanSecurityScheme.type).to.equal('oauth1');
  });

  it('should not return an auth with a null type for an unmapped security scheme type', function() {
    let securitySchemes = {
      passThrough: { name: 'passThrough', type: 'Pass Through' },
      custom: { name: 'custom', type: 'x-custom-token' },
      unknown: { name: 'unknown', type: 'Bearer Token' }
    };

    _.forEach(['passThrough', 'custom', 'unknown', 'missing', null, { custom: { scopes: ['A'] } }], (securedBy) => {
      expect(helper.convertSecurityScheme(securedBy, securitySchemes), JSON.stringify(securedBy)).to.be.null;
    });
  });

  it('should map object form securedBy (with parameters) to its scheme', function() {
    let securitySchemes = { oauth_2_0: { name: 'oauth_2_0', type: 'OAuth 2.0' } };

    expect(helper.convertSecurityScheme({ oauth_2_0: { scopes: ['ADMINISTRATOR'] } }, securitySchemes).type)
      .to.equal('oauth2');
  });

  it('should not add describedBy of known security scheme types to the request', function() {
    _.forEach({
      'Basic Authentication': 'basic',
      'Digest Authentication': 'digest',
      'OAuth 1.0': 'oauth1',
      'OAuth 2.0': 'oauth2'
    }, (pmType, ramlType) => {
      let securitySchemes = {
          scheme: {
            name: 'scheme',
            type: ramlType,
            describedBy: {
              headers: { Authorization: { name: 'Authorization', type: ['string'], example: 'x' } },
              queryParameters: { access_token: { name: 'access_token', type: ['string'], example: 'x' } }
            }
          }
        },
        security = helper.resolveSecurityScheme(['scheme'], securitySchemes, {}, 'example');

      expect(security.auth.type, ramlType).to.equal(pmType);
      expect(security.headers, ramlType).to.be.empty;
      expect(security.queryParams, ramlType).to.be.empty;
    });
  });

  describe('should generate postman body', function() {
    it('for an option requestParametersResolution set to schema', function() {
      let ramlBody = {
          'application/json': {
            name: 'application/json',
            displayName: 'application/json',
            typePropertyKind: 'TYPE_EXPRESSION',
            type: ['Invoice'],
            example: { amount: '1221,', vendorName: 'vendor' }
          }
        },
        types = {
          Invoice: {
            name: 'Invoice',
            displayName: 'Invoice',
            typePropertyKind: 'TYPE_EXPRESSION',
            type: ['object'],
            properties: { amount: { type: ['number'] }, vendorName: { type: ['string'] } }
          }
        },
        expectedBody = { amount: '<number>', vendorName: '<string>' },
        postmanBody = JSON.parse(helper.convertToPmBody(
          ramlBody, types, { requestParametersResolution: 'schema' }
        ).body);

      expect(postmanBody).to.deep.equal(expectedBody);
    });

    it('for an option requestParametersResolution set to example', function() {
      let ramlBody = {
          'application/json': {
            name: 'application/json',
            displayName: 'application/json',
            typePropertyKind: 'TYPE_EXPRESSION',
            type: ['Invoice'],
            example: { amount: '1221', vendorName: 'vendor' }
          }
        },
        types = {
          Invoice: {
            name: 'Invoice',
            displayName: 'Invoice',
            typePropertyKind: 'TYPE_EXPRESSION',
            type: ['object'],
            properties: { amount: { type: ['number'] }, vendorName: { type: ['string'] } }
          }
        },
        expectedBody = { amount: '1221', vendorName: 'vendor' },
        postmanBody = JSON.parse(helper.convertToPmBody(
          ramlBody, types, { requestParametersResolution: 'example' }
        ).body);

      expect(postmanBody).to.deep.equal(expectedBody);
    });
  });

  it('should convert baseUrl path params into postman collection variables', function() {
    let ramlBody = {
        version: {
          name: 'version',
          displayName: 'version',
          typePropertyKind: 'TYPE_EXPRESSION',
          type: [
            'string'
          ],
          required: true,
          enum: [
            'v5'
          ],
          __METADATA__: {}
        }
      },
      expectedVariables = [
        {
          id: 'version',
          description: {
            content: 'This is version of API schema.',
            type: 'text/plain'
          },
          type: 'any',
          value: 'v5'
        },
        {
          id: 'baseUrl',
          type: 'string',
          value: 'https://amazonaws.com/{{version}}'
        }
      ],
      resultVariables = helper.convertToPmCollectionVariables(ramlBody, 'baseUrl', 'https://amazonaws.com/{version}');

    // Using stringify to avoid Some properties of collection sdk variable.
    expect(JSON.stringify(resultVariables)).to.equal(JSON.stringify(expectedVariables));
  });

  it('should convert body with circular types', function(done) {
    let ramlTypes = {
        'a': {
          'name': 'a',
          'type': ['array'],
          'items': 'b'
        },
        'b': {
          'name': 'b',
          'type': ['object'],
          'properties': {
            'c': {
              'name': 'c',
              'type': ['a'],
              'required': true
            }
          }
        }
      },
      ramlBody = {
        'application/json': {
          'name': 'application/json',
          'type': [
            'a'
          ]
        }
      },
      postmanBody = helper.convertToPmBody(ramlBody, ramlTypes, { requestParametersResolution: 'schema' }),
      tooManyLevelsString = JSON.parse(postmanBody.body)[0].c[0].c[0].c[0].c[0].c.value;

    expect(postmanBody).to.not.equal(null);
    expect(tooManyLevelsString).to.equal('<Error: Too many levels of nesting to fake this schema>');
    done();
  });
});

describe('Pass Through, x-* and unmapped security schemes', function() {
  /**
   * @param {Object} request - request JSON
   * @param {String} key - header key
   * @returns {Array} headers with that key (case-insensitive)
   */
  function headersNamed (request, key) {
    return _.filter(request.header, (header) => { return _.toLower(header.key) === _.toLower(key); });
  }

  it('should add Pass Through describedBy headers instead of setting auth', function(done) {
    convertToRequests(fixture('passThroughSecuritySchemes.raml'), { requestParametersResolution: 'Example' },
      (collection, requests) => {
        _.forEach(['GET /pets', 'GET /pets/:petId'], (name) => {
          expect(requests[name], name).to.not.have.property('auth');
          expect(headersNamed(requests[name], 'X-API-Key'), name)
            .to.deep.equal([{ key: 'X-API-Key', value: 'abc123' }]);
        });
        done();
      });
  });

  it('should add Pass Through describedBy headers with default options', function(done) {
    convertToRequests(fixture('passThroughSecuritySchemes.raml'), {}, (collection, requests) => {
      expect(requests['GET /pets']).to.not.have.property('auth');
      expect(headersNamed(requests['GET /pets'], 'X-API-Key')).to.have.lengthOf(1);
      done();
    });
  });

  it('should add Pass Through describedBy query parameters and keep the Content-Type header', function(done) {
    convertToRequests(fixture('passThroughSecuritySchemes.raml'), {}, (collection, requests) => {
      let request = requests['POST /pets'];

      expect(request).to.not.have.property('auth');
      expect(request.url.query).to.deep.equal([{ key: 'api_key', value: 'abc123' }]);
      expect(headersNamed(request, 'Content-Type')).to.deep.equal([{ key: 'Content-Type', value: 'application/json' }]);
      expect(headersNamed(request, 'X-API-Key')).to.be.empty;
      done();
    });
  });

  it('should add x-* describedBy headers to every secured request', function(done) {
    convertToRequests(fixture('customSecuritySchemes.raml'), { requestParametersResolution: 'Example' },
      (collection, requests) => {
        expect(_.keys(requests)).to.have.members(['GET /pets', 'POST /pets']);
        _.forEach(requests, (request, name) => {
          expect(request, name).to.not.have.property('auth');
          expect(headersNamed(request, 'X-Custom-Token'), name)
            .to.deep.equal([{ key: 'X-Custom-Token', value: 'tok_123' }]);
        });
        done();
      });
  });

  describe('edge cases', function() {
    let requests;

    before(function(done) {
      convertToRequests(fixture('securitySchemesEdgeCases.raml'), { requestParametersResolution: 'Example' },
        (collection, convertedRequests) => {
          requests = convertedRequests;
          done();
        });
    });

    it('should apply root level securedBy to requests without their own', function() {
      expect(requests['GET /inherited']).to.not.have.property('auth');
      expect(headersNamed(requests['GET /inherited'], 'X-API-Key'))
        .to.deep.equal([{ key: 'X-API-Key', value: 'abc123' }]);
    });

    it('should keep the method\'s own header over the scheme\'s (case-insensitive)', function() {
      expect(headersNamed(requests['GET /own-header'], 'X-API-Key'))
        .to.deep.equal([{ key: 'x-api-key', value: 'method_value' }]);
    });

    it('should not set auth or add headers for securedBy: [null]', function() {
      expect(requests['GET /anonymous']).to.not.have.property('auth');
      expect(requests['GET /anonymous'].header || []).to.be.empty;
    });

    it('should add describedBy headers and query params after the method\'s own, without duplicates', function() {
      let request = requests['GET /both'];

      expect(_.map(request.header, 'key')).to.deep.equal(['X-Trace', 'X-Client-Id']);
      expect(request.url.query).to.deep.equal([
        { key: 'page', value: '1' },
        { key: 'signature', value: 'method_sig' }
      ]);
    });

    it('should resolve object form securedBy and skip describedBy of known types', function() {
      expect(requests['GET /scoped'].auth).to.deep.equal({ type: 'oauth2' });
      expect(headersNamed(requests['GET /scoped'], 'Authorization')).to.be.empty;
    });
  });

  it('should not set auth for an unknown scheme type or a missing scheme', function(done) {
    let ramlString = [
      '#%RAML 1.0',
      'title: T',
      'baseUri: https://x.test',
      'securitySchemes:',
      '  bearer:',
      '    type: Bearer Token',
      '    describedBy:',
      '      headers:',
      '        X-Bearer: { type: string, example: b }',
      '/unknown:',
      '  get:',
      '    securedBy: [bearer]',
      '/missing:',
      '  get:',
      '    securedBy: [does_not_exist]'
    ].join('\n');

    convertToRequests({ type: 'string', data: ramlString }, { requestParametersResolution: 'Example' },
      (collection, requests) => {
        expect(requests['GET /unknown']).to.not.have.property('auth');
        expect(requests['GET /unknown'].header).to.deep.equal([{ key: 'X-Bearer', value: 'b' }]);
        expect(requests['GET /missing']).to.not.have.property('auth');
        expect(requests['GET /missing'].header || []).to.be.empty;
        done();
      });
  });

  it('should carry describedBy description and required: false into the request as written in the spec',
    function(done) {
      let ramlString = [
        '#%RAML 1.0',
        'title: T',
        'baseUri: https://x.test',
        'securitySchemes:',
        '  api_key:',
        '    type: Pass Through',
        '    describedBy:',
        '      headers:',
        '        X-API-Key:',
        '          type: string',
        '          example: abc123',
        '          description: Key issued per tenant',
        '        X-Tenant:',
        '          type: string',
        '          example: acme',
        '          required: false',
        '      queryParameters:',
        '        api_sig:',
        '          type: string',
        '          example: sig_1',
        '          description: HMAC of the request',
        '/pets:',
        '  get:',
        '    securedBy: [api_key]'
      ].join('\n');

      convertToRequests({ type: 'string', data: ramlString }, { requestParametersResolution: 'Example' },
        (collection, requests) => {
          expect(requests['GET /pets']).to.not.have.property('auth');
          expect(requests['GET /pets'].header).to.deep.equal([
            { key: 'X-API-Key', value: 'abc123', description: 'Key issued per tenant' },
            { key: 'X-Tenant', value: 'acme', disabled: true }
          ]);
          expect(requests['GET /pets'].url.query).to.deep.equal([
            { key: 'api_sig', value: 'sig_1', description: 'HMAC of the request' }
          ]);
          done();
        });
    });

  it('should still produce a schema-valid collection for an existing fixture', function(done) {
    convertToRequests(fixture('ramlSpecBasic.raml'), {}, () => { done(); });
  });
});
