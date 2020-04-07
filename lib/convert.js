const raml = require('./../assets/raml-1-parser'),
  _ = require('lodash'),
  fs = require('fs'),
  path = require('path'),
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
 * This function will resolve !include statements
 * if mentioned path matches imported file (among all files in selected forlder)
 *
 * @param {String} filePath - file path mentioned in !include statement of RAML spec
 * @returns {String} resolved content
 */
function fileResolver (filePath) {
  var resolvedFile,
    absolutePath = path.join(path.parse(this.rootFilePath).dir, filePath); // use path for windows compatibility

  // Do not resolve file if not present in given files array
  if (_.includes(this.allFilePaths, absolutePath) && fs.existsSync(absolutePath)) {
    resolvedFile = absolutePath;
  }

  return (resolvedFile ? fs.readFileSync(resolvedFile).toString() : filePath + ' could not be resolved.');
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
    else if (option.availableOptions) {
      if (!_.includes(option.availableOptions, options[option.id])) {
        options[option.id] = option.default;
      }
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
  * @param {Array} files - Array of all file objects (for Folder Import)
  * @param {Function} cb - callback function
  * @returns {Object} collection - postman sdk collection Object
  */
  convert: function(ramlString, options, files, cb) {
    try {

      // assign cb function if no files are present
      if (_.isFunction(files)) {
        cb = files;
      }

      let collection = new SDK.Collection(),
        ramlAPI = raml.parseRAMLSync(ramlString, {
          fsResolver: {
            rootFilePath: files.rootFilePath,
            allFilePaths: _.isArray(files.allFilePaths) ? _.map(files.allFilePaths, 'fileName') : [],
            content: fileResolver
          }
        }),
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
          collection.items.add(helper.convertResources(convertedBaseUrl, resource, rootParameters, options));
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
      return cb(null, {
        result: false,
        reason: e.toString()
      });
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
    let obj = {
      result: (inputString.trim().split('\n')[0].trim() === '#%RAML 1.0'),
      reason: ''
    };

    if (!obj.result) {
      obj.reason = 'REQUIRED YAML-comment line that indicates the RAML version is missing. #%RAML 1.0';
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
        id: 'requestParametersResolution',
        type: 'enum',
        default: 'schema',
        availableOptions: ['example', 'schema'],
        description: 'Determines how request parameters (query parameters, path parameters, headers,' +
         ' or the request body) should be generated. Setting this to schema will cause the importer to' +
         ' use the parameter\'s schema as an indicator; `example` will cause the example (if provided)' +
         ' to be picked up.'
      },
      {
        name: 'Set resolution of types in Examples',
        id: 'exampleParametersResolution',
        type: 'enum',
        default: 'example',
        availableOptions: ['example', 'schema'],
        description: 'Determines how response parameters (query parameters, path parameters, headers,' +
          ' or the request body) should be generated. Setting this to schema will cause the importer to' +
          ' use the parameter\'s schema as an indicator; `example` will cause the example (if provided)' +
          ' to be picked up.'
      }
    ];
  }
};

module.exports = converter;
