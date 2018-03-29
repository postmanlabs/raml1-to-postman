const expect = require('chai').expect,
    converter = require('./../convert.js'),
    helper = require('./../helper.js');

/* global describe, it */
describe('Validate raml', function() {
    it('should validate valid raml string', function() {
        let ramlString = `#%RAML 1.0
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
