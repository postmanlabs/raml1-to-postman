const raml = require("raml-1-parser"),
    SDK = require('postman-collection'),
    validator = require('postman_validator'),
    helper = require('./helper.js');

var converter = {

    globalParameters: {
          mediaType: '',
          types: {},
          resourceTypes: {},
          traits: {},
          securitySchemes: {},
          securedBy: {}
        },

    convert: function(ramlString) {
        let collection = new SDK.Collection(),
          ramlAPI = raml.parseRAMLSync(ramlString),
          ramlJSON = ramlAPI.toJSON(),
          documentation = ramlJSON.documentation || '',
          description = ramlJSON.description || '';

        //raml root conversion
        ramlJSON.title && ( collection.name = ramlJSON.title );
        ramlJSON.version && ( collection.version = ramlJSON.version );
        collection.describe(documentation.concat(description));
        ramlJSON.mediaType && ( converter.globalParameters.mediaType = ramlJSON.mediaType);
        ramlJSON.types && ( converter.globalParameters.types = ramlJSON.types);
        ramlJSON.traits && ( converter.globalParameters.traits = ramlJSON.traits);
        ramlJSON.resourceTypes && ( converter.globalParameters.resourceTypes = ramlJSON.resourceTypes);
        ramlJSON.securitySchemes && (converter.globalParameters.securitySchemes = ramlJSON.securitySchemes);
        ramlJSON.securedBy && (converter.globalParameters.securedBy = ramlJSON.securedBy);

        //convert resources
        ramlJSON.resources && ramlJSON.resources.forEach( function (resource) {
            helper.convertResources (resource);
        });
        return collection;
    },

    validate: function(collectionJSON) {

        if (validator.validateJSON('c', collectionJSON).status) {
            console.log('The conversion was successful');
            return true;
        } else {
            console.log("Could not validate generated file");
            return false;
        }
    }
};

module.exports = converter;
