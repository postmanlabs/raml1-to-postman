const raml = require('raml-1-parser'),
    SDK = require('postman-collection'),
    helper = require('./helper.js');

/**
 * Used to convert array to a map
 *
 * @param  {Object} array - an array of objects
 * @returns {Object} map
 */
function arrayToMap(array) {
    let map = {},
        index,
        first;

    for (index in array) {
        if (Object.prototype.hasOwnProperty.call(array, index)) {
            let mapElement = array[index];

            for (first in mapElement) {
                if (Object.prototype.hasOwnProperty.call(mapElement, first)) {
                    map[first] = mapElement[first];
                }
            }
        }
    }

    return map;
}

var converter = {

    /**
    * Used to convert a raml String to postman sdk collection Object
    *
    * @param {String} ramlString - string with valid raml 1.0 format
    * @returns {Object} collection - postman sdk collection Object
    */
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
            };

        collection = helper.setCollectionInfo(info, collection);
        ramlJSON.types && (RootParameters.types = arrayToMap(ramlJSON.types));
        ramlJSON.securitySchemes && (RootParameters.securitySchemes = arrayToMap(ramlJSON.securitySchemes));
        baseUrl.key = 'baseUrl';
        baseUrl.value = helper.addParametersToUrl(ramlJSON.baseUri, ramlJSON.baseUriParameters);
        collection.variables.add(baseUrl);

        ramlJSON.resources && ramlJSON.resources.forEach(function (resource) {
            collection.items.add(helper.convertResources(baseUrl, resource, RootParameters));
        });

        return collection;
    },

    /**
    *
    * Used to check if the input string is a valid raml 1.0 format
    *
    * @param {string} inputString - raml String
    * @returns {Object} {result: true/false, reason: 'string'}
    */
    validate: function(inputString) {
        let valid = inputString.startsWith('#%RAML 1.0\n'),
            obj = {
                result: inputString.startsWith('#%RAML 1.0\ntitle:'),
                reason: ''
            };

        if (!valid) {
            obj.reason = 'REQUIRED YAML-comment line that indicates the RAML version is missing. #%RAML 1.0';
        }
        else if (valid && !obj.result) {
            obj.reason = 'Missing required property title';
        }

        return obj;
    }
};

module.exports = converter;
