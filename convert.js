const raml = require('raml-1-parser'),
    SDK = require('postman-collection'),
    helper = require('./helper.js');

function arrayToMap(array) {
    let map = {};

    for(var index in array) {
        let mapElement = array[index],
            element;

        for(var first in mapElement) {
            map[first] = mapElement[first];
        }
    }

    return map;
}

var converter = {

    convert: function(ramlString) {
        let collection = new SDK.Collection(),
            ramlAPI = raml.parseRAMLSync(ramlString),
            ramlJSON = ramlAPI.toJSON(),
            baseUrl = new SDK.Variable(),
            info = {
                title: ramlJSON.title || '',
                documentation: ramlJSON.documentation || '',
                description: ramlJSON.description || '',
                version: ramlJSON.version || ''
            },
            RootParameters = {
                mediaType: ramlJSON.mediaType,
                types: '',
                baseUri: ramlJSON.baseUri,
                baseUriParameters: ramlJSON.baseUriParameters,
                securitySchemes: '',
                securedBy: ramlJSON.securedBy || ''
            },
            types;

        collection = helper.setCollectionInfo(info, collection);
        ramlJSON.types && (RootParameters.types = arrayToMap(ramlJSON.types));
        ramlJSON.securitySchemes && (RootParameters.securitySchemes = arrayToMap(ramlJSON.securitySchemes));
        baseUrl.key = 'baseUrl';
        baseUrl.value = helper.addParametersToUrl(ramlJSON.baseUri, ramlJSON.baseUriParameters);
        collection.variables.add(baseUrl);

        ramlJSON.resources && ramlJSON.resources.forEach( function (resource) {
            collection.items.add(helper.convertResources(baseUrl, resource, RootParameters));
        });

        return collection;
    },

    validate: function(inputString) {
        return inputString.startsWith('#%RAML 1.0\ntitle:');
    }
};

module.exports = converter;
