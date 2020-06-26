const raml = require('./../assets/raml-1-parser'),
  _ = require('lodash'),
  fs = require('fs'),
  path = require('path-browserify'),
  SDK = require('postman-collection'),
  helper = require('./helper.js'),
  getOptions = require('./options').getOptions,
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
 * @param {Array} userOptions - Array of option objects received by convert function
 * @returns {Object} overridden options
 */
function overrideOptions(userOptions) {
  // predefined options
  var defaultOptions = _.keyBy(getOptions(), 'id'),
    retVal = {};

  for (let id in defaultOptions) {
    if (defaultOptions.hasOwnProperty(id)) {

      // set the default value to that option if the user has not defined
      if (userOptions[id] === undefined) {
        retVal[id] = defaultOptions[id].default;

        // ignore case-sensitivity for enum option with type string
        if (defaultOptions[id].type === 'enum' && _.isString(retVal[id])) {
          retVal[id] = _.toLower(defaultOptions[id].default);
        }
        continue;
      }

      // check the type of the value of that option came from the user
      switch (defaultOptions[id].type) {
        case 'boolean':
          if (typeof userOptions[id] === defaultOptions[id].type) {
            retVal[id] = userOptions[id];
          }
          else {
            retVal[id] = defaultOptions[id].default;
          }
          break;
        case 'enum':
          // ignore case-sensitivity for string options
          if ((defaultOptions[id].availableOptions.includes(userOptions[id])) ||
            (_.isString(userOptions[id]) &&
            _.map(defaultOptions[id].availableOptions, _.toLower).includes(_.toLower(userOptions[id])))) {
            retVal[id] = userOptions[id];
          }
          else {
            retVal[id] = defaultOptions[id].default;
          }

          // ignore case-sensitivity for string options
          _.isString(retVal[id]) && (retVal[id] = _.toLower(retVal[id]));

          break;
        case 'array':
          // user input needs to be parsed
          retVal[id] = userOptions[id];

          if (typeof retVal[id] === 'string') {
            // eslint-disable-next-line max-depth
            try {
              retVal[id] = JSON.parse(userOptions[id]);
            }
            catch (e) {
              // user didn't provide valid JSON
              retVal[id] = defaultOptions[id].default;
            }
          }

          // for valid JSON that's not an array, fallback to default
          if (!Array.isArray(retVal[id])) {
            retVal[id] = defaultOptions[id].default;
          }

          break;
        default:
          retVal[id] = defaultOptions[id].default;
      }
    }
  }

  return retVal;
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
      var fileContentMap = {},
        browser = false;

      // assign cb function if no files are present
      if (_.isFunction(files)) {
        cb = files;
      }
      // All the files content is already provided in the files object.
      // Create a fileContentMap
      else if (_.isArray(files.allFilePaths) && 'content' in files.allFilePaths[0]) {
        browser = true;
        _.forEach(files.allFilePaths, (file) => {
          fileContentMap[path.resolve(file.fileName)] = file.content;
        });

        /**
         * @param {String} path filepath
         * @return {String} file
         */
        function fileDataResolver (path) { // eslint-disable-line no-unused-vars
          return fileContentMap[path] ? fileContentMap[path] : path + ' could not be resolved.';
        }
      }

      let collection = new SDK.Collection(),
        content = browser ? fileDataResolver : fileResolver,
        ramlAPI = raml.parseRAMLSync(ramlString, {
          fsResolver: {
            rootFilePath: files.rootFilePath,
            allFilePaths: _.isArray(files.allFilePaths) ? _.map(files.allFilePaths, 'fileName') : [],
            content: content
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
      reason: '',
      raml: inputString
    };

    if (!obj.result) {
      obj.reason = 'REQUIRED YAML-comment line that indicates the RAML version is missing. #%RAML 1.0';
    }


    return obj;
  },

  getOptions: getOptions
};

module.exports = converter;
