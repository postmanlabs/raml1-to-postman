const expect = require('chai').expect,
    converter = require('./../../lib/convert.js'),
    helper = require('./../../lib/helper.js'),
    SDK = require('postman-collection');

/* global describe, it */
describe('Validate raml', function() {
    it('should validate valid raml string', function() {
        let ramlString = `#%RAML 1.0\ntitle: API with Examples
                description: Something
                baseUri: www.google.com/{something}
                types:
                  User:
                    type: object
                    properties:
                      name: string
                      lastname: string
                    example:
                      name: Bob
                /organisation/{version}:
                  post:
                    headers:
                      UserID:
                        description: the identifier for the user that posts a new organisation
                        type: string
                        example: SWED-123 # single scalar example
                    body:
                      application/json:
                        type: Org
                        example: # single request body example
                          value: # needs to be declared since type contains 'value' property
                            name: Doe Enterprise
                            value: Silver`,
            valid = converter.validate(ramlString);

        expect(valid).to.be.equal(true);
    });

    it('should not validate invalid raml string', function() {
        let ramlString = `#%RAML 1.0v
                title: API with Examples
                description: Something
                baseUri: www.google.com/{something}
                types:
                  User:
                    type: object
                    properties:
                      name: string
                      lastname: string
                    example:
                      name: Bob
                /organisation/{version}:
                  post:
                    headers:
                      UserID:
                        description: the identifier for the user that posts a new organisation
                        type: string
                        example: SWED-123 # single scalar example
                    body:
                      application/json:
                        type: Org
                        example: # single request body example
                          value: # needs to be declared since type contains 'value' property
                            name: Doe Enterprise
                            value: Silver`,
            valid = converter.validate(ramlString);

        expect(valid).to.be.equal(false);
    });
});

describe('helper functions', function() {
    it('should convert raml header into postman header', function() {
        let ramlHeader =
                      { name: 'UserID',
                          displayName: 'UserID',
                          typePropertyKind: 'TYPE_EXPRESSION',
                          type: ['string'],
                          example: 'SWED-123',
                          required: true,
                          description: 'the identifier for the user that posts a new organisation',
                          __METADATA__: { primitiveValuesMeta: { displayName: [Object], required: [Object] } },
                          structuredExample:
                         { value: 'SWED-123',
                             strict: true,
                             name: null,
                             structuredValue: 'SWED-123' } },
            postmanHeader = helper.convertHeader(ramlHeader);

        expect(postmanHeader).to.be.an('object');
        expect(postmanHeader.key).to.equal('UserID');
        expect(postmanHeader.value).to.equal('SWED-123');
        expect(postmanHeader.description).to.equal('the identifier for the user that posts a new organisation');
    });

    it('Should add params to url', function() {
        let baseUrl = 'www.sampleBaseUrl.com/{param}',
            params = {
                param: {
                    name: 'param',
                    displayName: 'param',
                    typePropertyKind: 'TYPE_EXPRESSION',
                    type: ['string'],
                    required: true,
                    __METADATA__: { calculated: true, primitiveValuesMeta: [Object] }
                }
            },
            url = helper.addParametersToUrl(baseUrl, params);

        expect(url).to.be.a('string');
        expect(url).to.equal('www.sampleBaseUrl.com/:param');

    });

    it('should set info for collection', function() {
        let info = {
                title: 'My sample api',
                documentation: 'This is the documentation.',
                description: 'This is the description.',
                version: '1.1'
            },
            collection = new SDK.Collection(),
            modified_collection = helper.setCollectionInfo(info, collection);

        expect(modified_collection.name).to.equal('My sample api');
        expect(modified_collection.version).to.equal('1.1');
        expect(modified_collection.description).to.equal('This is the documentation.This is the description.');

    });

    it('should add query parameters to url', function() {
        let queryParams = {
                page:
                 { name: 'page',
                     displayName: 'page',
                     example: 'hello'
                 },
                per_page:
                 { name: 'per_page',
                     displayName: 'per_page',
                     type: ['integer'],
                     example: 10
                 }
            },
            modifiedUrl = helper.constructQueryStringFromQueryParams(queryParams);

        expect(modifiedUrl).to.equal('?page=hello&per_page=10');

    });

    it('should construct query string', function() {
        let queryString = '?page&per_page',
            modifiedQueryString = helper.constructQueryString(queryString, {});

        expect(modifiedQueryString).to.equal('?page&per_page');
    });

    it('should return contentType header', function() {
        let mediaType = 'application/json',
            header = helper.getContentTypeHeader(mediaType);

        expect(header.key).to.equal('Content-Type');
        expect(header.value).to.equal('application/json');
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
            postmanHeader = helper.convertHeader(ramlHeader, types);

        expect(SDK.Header.isHeader(postmanHeader)).to.be.true;
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

    it('should generate postman body', function() {
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
                    properties: { amount: { type: 'number' }, vendorName: { type: 'string' } }
                }
            },
            expectedBody = { amount: '1221,', vendorName: 'vendor' },
            postmanBody = helper.convertBody(ramlBody, types);

        expect(postmanBody).to.deep.equal(expectedBody);

    });
});
