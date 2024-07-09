const expect = require('chai').expect,
  fs = require('fs'),
  converter = require('../../index'),
  helper = require('./../../lib/helper.js'),
  { Collection } = require('postman-collection/lib/collection/collection'),
  { Header } = require('postman-collection/lib/collection/header'),
  VALID_RAML_DIR_PATH = './test/fixtures/valid-raml',
  INVALID_VERSION_PATH = './test/fixtures/invalid-raml/invalidVersion.raml';

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
          value: 10
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
