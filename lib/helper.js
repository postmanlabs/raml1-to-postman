const SDK = require('postman-collection'),
  _ = require('lodash'),
  jsf = require('json-schema-faker'),
  INDENT_COUNT = 2;

jsf.option({
  alwaysFakeOptionals: true
});

var authTypeMap = {
    basic: 'basic',
    oauth_1_0: 'oauth1',
    oauth_2_0: 'oauth2',
    digest: 'digest'
  },
  ramlDefaultDataTypes = {
    string: true,
    integer: true,
    boolean: true,
    array: true
  },
  helper;

/**
*
* Used to get body Schema with proper examples in format specified by postman v2 collection schema
*
* @param {Object} body - raml body in json format
* @param {Object} types - raml types map
*
* @returns {Object} schema - postman body schema
*/
function getBodySchema(body, types) {
  let type,
    typeProperties,
    schema = {},
    schemaFaker = {},
    property;

  if (body.example) {
    schema = body.example;
  }
  else if (body.examples) {
    for (var first in body.examples) {
      if (Object.prototype.hasOwnProperty.call(body.examples, first)) {
        schema = body.examples[first].structuredValue;
        break;
      }
    }
  }
  else {
    for (property in body.properties) {
      if (Object.prototype.hasOwnProperty.call(body.properties, property)) {
        schemaFaker.properties = body.properties[property];
        schema[property] = body.properties[property].default ||
          body.properties[property].example ||
          jsf(schemaFaker)[property];
      }
    }
    if (body.type && body.type[0] !== 'object') {
      type = body.type[0];
      typeProperties = types[type].properties;
      for (property in typeProperties) {
        if (Object.prototype.hasOwnProperty.call(typeProperties, property)) {
          schemaFaker.properties = typeProperties[property];
          schema[property] = typeProperties[property].default ||
            typeProperties[property].example ||
            jsf(schemaFaker)[property];
        }
      }
    }
  }

  return schema;
}

/**
*
* Used to add the raml traits to raml method json
*
* @param {Object} method - raml method in json format
* @param {Object} traits - raml triats map
*
* @returns {Object} method - raml method with added traits
*/
function addTraitsToMethod(method, traits) {
  let modified_method = method,
    property;

  method.is.forEach(function(trait) {
    for (property in traits[trait]) {
      if (property !== 'name') {
        if (modified_method[property]) {
          Object.assign(modified_method[property], traits[trait][property]);
        }
        else {
          modified_method[property] = traits[trait][property];
        }
      }
    }
  });

  return modified_method;
}

helper = {


  /**
  *
  * Used to set name, description and version(info parameters) of a postman sdk collection object
  *
  * @param {Object} info - Object containing the info parameters
  * @param {Object} coll - postman sdk collection object
  *
  * @returns {Object} collection - postman sdk collection object
  */
  setCollectionInfo: function(info, coll) {
    let collection = coll;

    collection.name = info.title;
    collection.version = info.version;
    collection.description = helper.convertDescription(info.description, info.documentation);

    return collection;
  },

  /**
   * RAML 1.0 supports documentation of schema which supports Markdown.
   * This function converts it into postman description with some Markdown Formatting.
   * https://github.com/raml-org/raml-spec/blob/master/versions/raml-10/raml-10.md#user-documentation
   *
   * @param {String} ramlDescription - Description of an schema
   * @param {Array} ramlDocumentation - Documentation of schema
   *
   * @returns {String} - Postman collection description.
   */
  convertDescription: function(ramlDescription, ramlDocumentation) {
    let description;

    if (ramlDocumentation) {
      description = '# Description\n\n' + ramlDescription + '\n\n';
      description += '# Documentation\n\n';

      // Handle converted description for invalid documentation
      if (_.isArray(ramlDocumentation)) {
        _.forEach(ramlDocumentation, (value) => {
          if (value.title && value.content) {
            description += `## ${value.title}\n\n${value.content}\n\n`;
          }
          else {
            description += 'Invalid Documentaion key-value pair\n';
          }
        });
      }
      else {
        description += _.toString(ramlDocumentation);
      }
    }
    else {
      description = ramlDescription;
    }

    return description;
  },

  /**
  *
  * Used to convert a raml json header into postman sdk header object
  *
  * @param {Object} header - raml header in json format
  * @param {Object} types - raml types map
  *
  * @returns {Object} convertedHeader - postman sdk header object
  */
  convertHeader: function(header, types) {
    let convertedHeader = new SDK.Header();

    convertedHeader.key = header.name;
    if (header.required !== true) {
      convertedHeader.disabled = true;
    }
    header.description && (convertedHeader.description = header.description);

    if (!ramlDefaultDataTypes[header.type[0]]) {
      convertedHeader.value = types[header.type[0]].default || types[header.type[0]].example;
    }
    convertedHeader.value = header.default || header.example || convertedHeader.value;

    return convertedHeader;
  },

  /**
  *
  * Used to convert a raml body json into postman body
  *
  * @param {Object} ramlBody - raml body in json format
  * @param {Object} types - raml types map
  *
  * @returns {Object} body - postman body object
  */
  convertBody: function(ramlBody, types) {
    let body;

    if (ramlBody['application/json']) {
      body = getBodySchema(ramlBody['application/json'], types);
    }
    else {
      body = getBodySchema(ramlBody, types);
    }

    return body;
  },

  /**
  *
  * Used to convert a raml response json into postman sdk response object
  *
  * @param {Object} response - raml response in json format
  * @param {Object} types - raml types map
  *
  * @returns {Object} convertedResponse - postman sdk response object
  */
  convertResponse: function(response, types) {
    let convertedResponse = new SDK.Response();

    _.forEach(response, (res) => {
      convertedResponse.code = res.code;
      convertedResponse.name = res.name || res.code;
      res.body &&
        (convertedResponse.body = JSON.stringify(helper.convertBody(res.body, types, null), null, INDENT_COUNT));
      _.forEach(res.headers, (header) => {
        convertedResponse.headers.add(helper.convertHeader(header, types));
      });
    });

    return convertedResponse;
  },

  /**
  *
  * Used to get url query string constructed from raml query parameters
  *
  * @param {Object} queryParameters - query parameters extracted from raml
  *
  * @returns {string} query string
  */
  constructQueryStringFromQueryParams: function(queryParameters) {
    let SDKUrl = new SDK.Url();

    _.forEach(queryParameters, (param, key) => {
      SDKUrl.addQueryParams(new SDK.QueryParam({
        key: key,
        value: param.default || param.example || ''
      }));
    });

    return ('?' + SDKUrl.getQueryString());
  },

  /**
  *
  * Used to get url query string constructed from raml query string
  *
  * @param {Object} queryString - query string extracted from raml
  * @param {Object} types - raml types map
  *
  * @returns {string} query string
  */
  constructQueryString: function (queryString, types) {
    let typeArray = queryString.type,
      SDKUrl = new SDK.Url();

    if (typeof queryString === 'string') {
      return queryString;
    }

    _.forEach(typeArray, (type) => {
      _.forEach(_.get(types, type, {}).properties, (property, propertyKey) => {
        SDKUrl.addQueryParams(propertyKey);
      });
    });

    return SDKUrl.getQueryString();

  },

  /**
  *
  * Used to get postman sdk content-type header
  *
  * @param {String} mediaType - raml mediaType key
  *
  * @returns {string} postman sdk header object
  */
  getContentTypeHeader: function(mediaType) {

    return new SDK.Header({
      key: 'Content-Type',
      value: mediaType
    });
  },

  /**
  *
  * Used to convert raml security schemes to a postman sdk RequestAuth object
  *
  * @param {String} securedBy - raml security schemes
  * @param {Object} securitySchemes - object specifying various raml security schemes
  *
  * @returns {Object} auth - postman sdk RequestAuth object
  */
  convertSecurityScheme: function(securedBy, securitySchemes) {
    let auth = new SDK.RequestAuth();

    auth.type = authTypeMap[securedBy];
    securitySchemes[securedBy].description && (auth.describe(securitySchemes[securedBy].description));

    return auth;
  },

  /**
   * Converts the neccessary root level variables to the
   * something that can be added to the collection
   *
   * @param {Array} variablesToAdd - Object containing the root level variables at the root/path-item level
   * @param {String} keyName - an additional key to add the baseUrl to the variable list
   * @param {String} baseUrl - URL from the baseUrl object
   * @returns {Array} modified collection variable array
   */
  convertToPmCollectionVariables: function(variablesToAdd, keyName, baseUrl = '') {
    var variables = [],
      convertedBaseUrl = baseUrl;

    if (variablesToAdd) {
      _.forOwn(variablesToAdd, (value, key) => {
        // 'version' is reserved base URI parameter for RAML 1.0, value of it recieved in enum so special handling
        if (key === 'version') {
          variables.push(new SDK.Variable({
            id: key,
            value: _.get(value, 'enum[0]', ''),
            description: value.description || 'This is version of API schema.'
          }));
        }
        else {
          variables.push(new SDK.Variable({
            id: key,
            value: value.default || '',
            description: value.description + (value.enum ? ' (is one of ' + value.enum + ')' : '')
          }));
        }
        // replace base url variables according to postman variable identification syntax
        convertedBaseUrl = convertedBaseUrl.replace('{' + key + '}', '{{' + key + '}}');
      });
    }
    if (keyName) {
      variables.push(new SDK.Variable({
        id: keyName,
        value: convertedBaseUrl,
        type: 'string'
      }));
    }

    return variables;
  },

  /**
  *
  * Used to convert raml method json to a postman sdk item object
  *
  * @param {Object} method - raml method in json format
  * @param {String} url - url of the raml request
  * @param {Object} globalParameters - Object with parameters given at root level of raml spec
  * @param {Array} pathVariables - Optional path variables array to add value/description of path varibles in url
  *
  * @returns {Object} item - postman sdk item object
  */
  convertMethod: function(method, url, globalParameters, pathVariables) {
    let item = new SDK.Item(),
      request = new SDK.Request(),
      requestUrl = new SDK.Url(),
      mediaType = globalParameters.mediaType || 'application/json',
      securedBy = method.securedBy || globalParameters.securedBy,
      requestName = _.get(method, 'displayName', url.replace('{{baseUrl}}', ''));

    method.is && (method = addTraitsToMethod(method, globalParameters.traits));
    if (method.queryParameters) {
      url = url.concat(helper.constructQueryStringFromQueryParams(method.queryParameters));
    }
    if (method.queryString) {
      url = url.concat(helper.constructQueryString(method.queryString, globalParameters.types));
    }
    method.description && (request.description = method.description);
    method.body && (request.body = new SDK.RequestBody({
      mode: 'raw',
      raw: JSON.stringify(helper.convertBody(method.body, globalParameters.types, request), null, INDENT_COUNT)
    })) && request.headers.add(helper.getContentTypeHeader(mediaType));
    method.responses && (item.responses.add(helper.convertResponse(method.responses, globalParameters.types)));
    securedBy && (request.auth = helper.convertSecurityScheme(securedBy[0], globalParameters.securitySchemes));
    requestUrl.update(url);

    // Add path variables of url to request
    if (pathVariables) {
      requestUrl.variables = pathVariables;
    }
    request.url = requestUrl;
    request.method = _.toUpper(method.method);
    _.forEach(method.headers, (header) => {
      request.headers.add(helper.convertHeader(header, globalParameters.types));
    });
    item.name = requestName;
    item.request = request;

    return item;
  },

  /**
  *
  * Used to add parameters to postman url
  *
  * @param {string} baseUrl - base url string
  * @param {Object} params - raml url parameters object
  * @param {Object} types - raml types map
  *
  * @returns {Object} contains url - postman url string, variables - path variable array
  */
  addParametersToUrl: function(baseUrl, params, types) {
    let paramToReplace,
      paramToBeReplaced,
      variables = [],
      url = baseUrl,
      value,
      type;

    _.forEach(params, (param, key) => {
      variables.push({
        key: key,
        value: param.default || '',
        description: (param.description || '') + (param.enum ?
          ' (This can only be one of ' + param.enum.toString() + ')' : '')
      });

      paramToReplace = key;
      value = param.default || param.example;
      if (param.type[0] !== 'string' &&
        param.type[0] !== 'boolean' &&
        param.type[0] !== 'integer') {
        type = param.type[0];
        value = types[type].default || types[type].example || value;
      }
      paramToBeReplaced = '{' + key + '}';
      url = url.replace(paramToBeReplaced, ':' + paramToReplace);
    });

    return {
      url: url,
      variables: variables
    };
  },

  /**
  *
  * Used to convert raml resource json to a postman sdk ItemGroup object
  *
  * @param {string} baseUrl - base url string
  * @param {String} res - raml resource json
  * @param {Object} globalParameters - Object with parameters given at root level of raml spec
  * @param {Array} pathVariables - Array with all path variables and it's value and decription.
  *
  * @returns {Object} folder - postman sdk ItemGroup object
  */
  convertResources: function(baseUrl, res, globalParameters, pathVariables = []) {
    var folder = new SDK.ItemGroup(),
      url,
      convertedUrlAndVars;

    convertedUrlAndVars = helper.addParametersToUrl(res.relativeUri, res.uriParameters, globalParameters.types);
    url = baseUrl.value + convertedUrlAndVars.url;
    pathVariables = _.concat(pathVariables, convertedUrlAndVars.variables);

    baseUrl.value = url;
    res.displayName && (folder.name = res.displayName);
    res.description && (folder.description = res.description);
    res.is && res.methods.forEach(function (method) {
      method.is = res.is;
    });

    res.methods && res.methods.forEach(function (method) {
      folder.items.add(helper.convertMethod(method, url, globalParameters, pathVariables));
    });

    res.resources && res.resources.forEach(function (resource) {
      folder.items.add(helper.convertResources(baseUrl, resource, globalParameters, pathVariables));
    });

    return folder;
  }
};

module.exports = helper;
