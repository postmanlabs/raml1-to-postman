const raml = require('raml-1-parser'),
  _ = require('lodash'),
  SDK = require('postman-collection'),
  helper = require('./helper.js'),
  { Node, Trie } = require('./trie.js'),

  // This is the default collection name if one can't be inferred from the RAML 1.0 spec
  COLLECTION_NAME = 'Converted from RAML 1.0';

/**
 * Used to convert array to a map
 *
 * @param  {Object} array - an array of objects
 * @returns {Object} map
 */
function arrayToMap(array) {
  let map = {};

  _.forEach(array, (mapElement) => {
    _.forEach(mapElement, (element, key) => {
      _.set(map, key, element);
    });
  });

  return map;
}

/**
 * This function overrides options. If option is not present than default value ofrom getOptions() will be used.
 * It also checks if availableOptions are present then option should be one of them, otherwise default will be used.
 * And checks for type of option if it does not match than default is used.
 *
 * @param {Array} options - Array of option objects
 * @returns {Object} overridden options
 */
function overrideOptions(options) {
  // eslint-disable-next-line no-use-before-define
  var optionsToOverride = converter.getOptions();

  _.forEach(optionsToOverride, (option) => {
    if (!_.has(options, option.id)) {
      options[option.id] = option.default;
    }
    else if (option.availableOptions && !_.includes(option.availableOptions, options[option.id])) {
      options[option.id] = option.default;
    }
    else if (typeof options[option.id] !== option.type) {
      options[option.id] = option.default;
    }
  });

  return options;
}

var converter = {

  /**
  * Used to convert a raml String to postman sdk collection Object
  *
  * @param {String} ramlString - raml 1.0 schema
  * @param {Object} options - Options to customize generated postman collection
  * @param {Function} cb - callback function
  * @returns {Object} collection - postman sdk collection Object
  */
  convert: function(ramlString, options, cb) {
    try {
      let collection = new SDK.Collection(),
        ramlAPI = raml.parseRAMLSync(ramlString),
        ramlJSON = ramlAPI.toJSON(),
        convertedBaseUrl,
        trie,
        info = {
          title: _.get(ramlJSON, 'title', COLLECTION_NAME),
          documentation: _.get(ramlJSON, 'documentation', ''),
          description: _.get(ramlJSON, 'description', ''),
          version: _.get(ramlJSON, 'version', '')
        },
        rootParameters = {
          types: '',
          traits: '',
          baseUri: ramlJSON.baseUri,
          baseUriParameters: ramlJSON.baseUriParameters,
          securitySchemes: '',
          securedBy: _.get(ramlJSON, 'securedBy', '')
        };

      // Assign default options.
      options = overrideOptions(options);

      collection = helper.setCollectionInfo(info, collection);
      ramlJSON.types && (rootParameters.types = arrayToMap(ramlJSON.types));
      ramlJSON.traits && (rootParameters.traits = arrayToMap(ramlJSON.traits));
      ramlJSON.securitySchemes && (rootParameters.securitySchemes = arrayToMap(ramlJSON.securitySchemes));

      // Returns object containing url and all path variables with SDK compatible format
      // Also adds {{baseUrl}} collection variable
      helper.convertToPmCollectionVariables(
        ramlJSON.baseUriParameters,
        'baseUrl',
        ramlJSON.baseUri
      ).forEach((element) => {
        collection.variables.add(element);
      });

      // convrtedBaseUrl is URL containing baseUrl in form of PM collection variable
      convertedBaseUrl = new SDK.Variable({
        key: 'baseUrl',
        value: '{{baseUrl}}',
        type: 'string'
      });

      if (options.collapseFolders) {
        // creating a root node for the trie (serves as the root dir)
        trie = new Trie(new Node({ name: '/' }));

        // Generate/add trie nodes from raml resources to trie
        helper.generateTrieFromResources(trie, ramlJSON.resources, rootParameters, options);

        // Add each resource and it's childrens to postman collection
        _.forEach(trie.root.children, (child) => {
          collection.items.add(
            helper.convertChildToItemGroup(convertedBaseUrl, child, rootParameters, options)
          );
        });
      }
      else {
        ramlJSON.resources && _.forEach(ramlJSON.resources, (resource) => {
          collection.items.add(helper.convertResources(convertedBaseUrl, resource, rootParameters));
        });
      }

      return cb(null, {
        result: true,
        output: [{
          type: 'collection',
          data: collection.toJSON()
        }]
      });
    }
    catch (e) {
      return cb(e);
    }

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
  },

  /**
   * Used in order to get additional options for importing of RAML 1.0 schema (i.e. )
   *
   * @module getOptions
   *
   * @returns {Array} Options specific to generation of postman collection from RAML 1.0 schema
   */
  getOptions: function () {
    return [
      {
        name: 'Collapse folders',
        id: 'collapseFolders',
        type: 'boolean',
        default: true,
        description: 'Collapse folders with same parent path'
      },
      {
        name: 'Set resolution of types in Request',
        id: 'requestResolution',
        type: 'string',
        availableOptions: ['example', 'schema'],
        default: 'schema',
        description: 'Option for resolving types in root request body between schema or example'
      },
      {
        name: 'Set resolution of types in Examples',
        id: 'exampleResolution',
        type: 'string',
        availableOptions: ['example', 'schema'],
        default: 'example',
        description: 'Option for resolving types in example request and response between schema or example'
      }
    ];
  }
};

module.exports = converter;
