const SDK = require('postman-collection'),
  _ = require('lodash'),
  schemaFaker = require('../assets/json-schema-faker.js'),
  resolver = require('./resolver.js'),
  Node = require('./trie.js').Node,
  INDENT_COUNT = 2,
  URLENCODED = 'application/x-www-form-urlencoded',
  APP_JSON = 'application/json',
  APP_JS = 'application/javascript',
  TEXT_XML = 'text/xml',
  TEXT_PLAIN = 'text/plain',
  TEXT_HTML = 'text/html',
  FORM_DATA = 'multipart/form-data',
  PREVIEW_LANGUAGE = {
    JSON: 'json',
    XML: 'xml',
    TEXT: 'text',
    HTML: 'html',
    JS: 'javascript'
  };

schemaFaker.option({
  requiredOnly: false,
  optionalsProbability: 1.0, // always add optional fields
  minLength: 4, // for faked strings
  maxLength: 4,
  minItems: 1, // for arrays
  maxItems: 2,
  useDefaultValue: true,
  ignoreMissingRefs: true
});

var authTypeMap = {
    'Basic Authentication': 'basic',
    'OAuth 1.0': 'oauth1',
    'OAuth 2.0': 'oauth2',
    'Digest Authentication': 'digest'
  },
  ramlDefaultDataTypes = [
    'any',
    'object',
    'array',
    'string',
    'number', 'integer',
    'boolean',
    'date-only', 'time-only', 'datetime-only', 'datetime',
    'file',
    'nil'
  ],
  helper;

/**
* Safe wrapper for schemaFaker that resolves references and
* removes things that might make schemaFaker crash
* @param {*} oldSchema the schema to fake
* @param {*} types list of predefined components (with schemas)
* @returns {object} fakedObject
*/
function safeSchemaFaker(oldSchema, types) {
  var schema = resolver.resolveTypes(oldSchema, types);

  try {
    return schemaFaker(schema);
  }
  catch (e) {
    console.warn(
      'Error faking a schema. Not faking this schema. Schema:', schema,
      'Error', e
    );

    return null;
  }
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

    if (!ramlDefaultDataTypes[header.type[0]] && types[header.type[0]]) {
      convertedHeader.value = types[header.type[0]].default ||
        types[header.type[0]].example ||
        safeSchemaFaker(header, types);
    }
    convertedHeader.value = header.default ||
      header.example ||
      convertedHeader.value ||
      safeSchemaFaker(header, types);

    return convertedHeader;
  },

  /**
  *
  * Used to get body Schema with proper examples in format specified by postman v2 collection schema
  *
  * @param {Object} body - raml body in json format
  * @param {Object} types - raml types map
  *
  * @returns {Object} schema - postman body schema
  */
  getBodySchema: function (body, types) {
    let schema = {};

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
      schema = safeSchemaFaker(body, types);
    }

    return schema;
  },

  /**
   * converts RAML method body to an item requestBody (to a Postman request body)
   * @param {*} ramlBody - RAML method body
   * @param {Object} types - RAML types map
   * @returns {Object} - Postman requestBody and Content-Type Header
   */
  convertToPmBody: function(ramlBody, types) {
    var bodyData,
      param,
      paramArray = [],
      updateOptions = {},
      reqBody = new SDK.RequestBody(),
      contentHeader,
      rDataMode,
      cType;

    // to handle cases of malformed request body, where ramlBody is null
    if (!ramlBody) {
      return {
        body: reqBody,
        contentHeader: null
      };
    }

    // handling for the urlencoded media type
    if (ramlBody.hasOwnProperty(URLENCODED)) {
      rDataMode = 'urlencoded';
      bodyData = this.getBodySchema(ramlBody[URLENCODED], types, URLENCODED);

      // create query parameters and add it to the request body object
      _.forOwn(bodyData, (value, key) => {
        param = new SDK.QueryParam({
          key: key,
          value: (typeof value === 'object' ? JSON.stringify(value) : value)
        });
        paramArray.push(param);
      });

      updateOptions = {
        mode: rDataMode,
        urlencoded: paramArray
      };

      // add a content type header for each media type for the request body
      contentHeader = new SDK.Header({
        key: 'Content-Type',
        value: URLENCODED
      });

      // update the request body with the options
      reqBody.update(updateOptions);
    }
    else if (ramlBody.hasOwnProperty(FORM_DATA)) {
      rDataMode = 'formdata';
      bodyData = this.getBodySchema(ramlBody[FORM_DATA], types, FORM_DATA);

      // create the form parameters and add it to the request body object
      _.forOwn(bodyData, (value, key) => {
        param = new SDK.FormParam({
          key: key,
          value: (typeof value === 'object' ? JSON.stringify(value) : value)
        });
        paramArray.push(param);
      });

      updateOptions = {
        mode: rDataMode,
        formdata: paramArray
      };
      // add a content type header for the pertaining media type
      contentHeader = new SDK.Header({
        key: 'Content-Type',
        value: FORM_DATA
      });
      // update the request body
      reqBody.update(updateOptions);
    }
    else {
      rDataMode = 'raw';
      let bodyType,
        previewLanguage = PREVIEW_LANGUAGE.TEXT;

      // checking for all possible raw types and display options of pm body
      if (ramlBody.hasOwnProperty(APP_JSON)) {
        bodyType = APP_JSON;
        previewLanguage = PREVIEW_LANGUAGE.JSON;
      }
      else if (ramlBody.hasOwnProperty(TEXT_XML)) {
        bodyType = TEXT_XML;
        previewLanguage = PREVIEW_LANGUAGE.XML;
      }
      else if (ramlBody.hasOwnProperty(APP_JS)) {
        bodyType = APP_JS;
        previewLanguage = PREVIEW_LANGUAGE.JS;
      }
      else if (ramlBody.hasOwnProperty(TEXT_HTML)) {
        bodyType = TEXT_HTML;
        previewLanguage = PREVIEW_LANGUAGE.HTML;
      }
      else if (ramlBody.hasOwnProperty(TEXT_PLAIN)) {
        bodyType = TEXT_PLAIN;
      }
      else {
        // take the first property it has
        // types like image/png etc
        for (cType in ramlBody) {
          if (ramlBody.hasOwnProperty(cType)) {
            bodyType = cType;
            break;
          }
        }
      }

      bodyData = this.getBodySchema(ramlBody[bodyType], types, bodyType);

      updateOptions = {
        mode: rDataMode,
        raw: bodyType === APP_JSON ? JSON.stringify(bodyData, null, INDENT_COUNT) : bodyData,
        options: {
          raw: {
            language: previewLanguage
          }
        }
      };

      contentHeader = new SDK.Header({
        key: 'Content-Type',
        value: bodyType
      });

      reqBody.update(updateOptions);
    }

    return {
      body: reqBody,
      contentHeader: contentHeader
    };
  },

  /**
  *
  * Used to convert a raml response json into postman sdk response object
  *
  * @param {Object} responses - raml responses in json format
  * @param {Object} originalRequest - PM request object
  * @param {Object} types - raml types map
  *
  * @returns {Object} convertedResponse - postman sdk response object
  */
  convertResponse: function(responses, originalRequest, types) {
    let convertedResponses = [];

    if (!responses) {
      return null;
    }

    _.forEach(responses, (res) => {
      let responseBody = {},
        responseHeaders = [],
        responseBodyType,
        contentHeader,
        previewLanguage = 'text';

      _.forEach(res.headers, (header) => {
        responseHeaders.push(helper.convertHeader(header, types));
      });

      responseBodyType = Object.keys(_.get(res, 'body', {}))[0];

      if (responseBodyType) {
        responseBody = this.getBodySchema(res.body[responseBodyType], types);
        contentHeader = { key: 'Content-Type', value: responseBody };

        // set preview language (used in PM response body)
        if (responseBodyType === APP_JSON) {
          previewLanguage = PREVIEW_LANGUAGE.JSON;
          responseBody = JSON.stringify(responseBody, null, INDENT_COUNT);
        }
        else if (responseBodyType === TEXT_XML) { previewLanguage = PREVIEW_LANGUAGE.XML; }
        else if (responseBodyType === TEXT_HTML) { previewLanguage = PREVIEW_LANGUAGE.HTML; }
        else {
          previewLanguage = PREVIEW_LANGUAGE.TEXT;
          contentHeader = { key: 'Content-Type', value: TEXT_PLAIN };
        }
        responseHeaders.push(contentHeader);
      }

      convertedResponse = new SDK.Response({
        name: res.name || res.code,
        code: res.code ? Number(res.code) : 500,
        header: responseHeaders,
        body: responseBody,
        originalRequest: originalRequest
      });
      // set preview language according to response
      convertedResponse._postman_previewlanguage = previewLanguage;
      convertedResponses.push(convertedResponse);
    });

    return convertedResponses;
  },

  /**
  *
  * Used to get url query string constructed from raml query parameters
  *
  * @param {Object} queryParameters - query parameters extracted from raml
  * @param {Object} types - raml types map
  *
  * @returns {string} query string
  */
  constructQueryStringFromQueryParams: function(queryParameters, types) {
    let SDKUrl = new SDK.Url(),
      fakedSchema;

    _.forEach(queryParameters, (param, key) => {
      if (param.default || param.example) {
        SDKUrl.addQueryParams(new SDK.QueryParam({
          key: key,
          value: param.default || param.example
        }));
      }
      else {
        // stringify value for object type
        fakedSchema = safeSchemaFaker(param, types);
        SDKUrl.addQueryParams(new SDK.QueryParam({
          key: key,
          value: (_.isObject(fakedSchema) ? JSON.stringify(fakedSchema) : fakedSchema) || ''
        }));
      }
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
    let SDKUrl = new SDK.Url(),
      fakedQueryString;

    if (typeof queryString === 'string') {
      return queryString;
    }

    fakedQueryString = safeSchemaFaker(queryString, types);

    if (_.isObject(fakedQueryString)) {
      _.forEach(fakedQueryString, (value, key) => {
        SDKUrl.addQueryParams(new SDK.QueryParam({
          key: key,
          value: value
        }));
      });
    }
    else {
      SDKUrl.addQueryParams(fakedQueryString);
    }

    return ('?' + SDKUrl.getQueryString());

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

    // map RAML schema security schema and PM request auths. set null by default.
    auth.type = _.get(authTypeMap, _.get(securitySchemes[securedBy], 'type'), null);
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
            value: value.default || _.get(value.enum, '[0]') || '',
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
  * Used to convert raml method to a postman sdk item object
  *
  * @param {Object} method - raml method in json format
  * @param {String} url - url of the raml request
  * @param {Object} globalParameters - Object with parameters given at root level of raml spec
  * @param {Object} options - Options to customize generated postman collection
  * @param {Array} pathVariables - Optional path variables array to add value/description of path varibles in url
  *
  * @returns {Object} item - postman sdk item object
  */
  convertRequestToItem: function(method, url, globalParameters, options, pathVariables) {
    let item = new SDK.Item(),
      request = new SDK.Request(),
      requestUrl = new SDK.Url(),
      securedBy = method.securedBy || globalParameters.securedBy,
      requestName = _.get(method, 'displayName', url.replace('{{baseUrl}}', '')),
      pmRequestBody;

    method.is && (method = addTraitsToMethod(method, globalParameters.traits));
    if (method.queryParameters) {
      url = url.concat(helper.constructQueryStringFromQueryParams(method.queryParameters, globalParameters.types));
    }
    if (method.queryString) {
      url = url.concat(helper.constructQueryString(method.queryString, globalParameters.types));
    }
    method.description && (request.description = method.description);

    pmRequestBody = helper.convertToPmBody(method.body, globalParameters.types, INDENT_COUNT);
    request.body = pmRequestBody.body;
    request.addHeader(pmRequestBody.contentHeader);

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

    // pass request.toJSON() as extra fields are added in response for original request object
    _.forEach(helper.convertResponse(method.responses, request.toJSON(), globalParameters.types), (res) => {
      item.responses.add(res);
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
      url = baseUrl;

    _.forEach(params, (param, key) => {
      variables.push({
        key: key,
        value: param.default || param.example || safeSchemaFaker(param, types) || '',
        description: (param.description || '') + (param.enum ?
          ' (This can only be one of ' + param.enum.toString() + ')' : '')
      });

      paramToReplace = key;
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
      // used to store url after path variables of url is resolved
      convertedBaseUrl = _.cloneDeepWith(baseUrl),
      convertedUrlAndVars;

    convertedUrlAndVars = helper.addParametersToUrl(res.relativeUri, res.uriParameters, globalParameters.types);
    url = baseUrl.value + convertedUrlAndVars.url;
    pathVariables = _.concat(pathVariables, convertedUrlAndVars.variables);

    // replace current url with resolved path variable one
    convertedBaseUrl.value = url;
    res.displayName && (folder.name = res.displayName);
    res.description && (folder.description = res.description);
    res.is && res.methods.forEach(function (method) {
      method.is = res.is;
    });

    res.methods && res.methods.forEach(function (method) {
      folder.items.add(helper.convertRequestToItem(method, url, globalParameters, pathVariables));
    });

    res.resources && res.resources.forEach(function (resource) {
      folder.items.add(helper.convertResources(convertedBaseUrl, resource, globalParameters, pathVariables));
    });

    return folder;
  },

  /**
   *
   * convert childItem to Postman itemGroup if requestCount(no of requests inside childitem) > 1
   * or it is collapsible folder otherwise return postman request
   *
   * @param {string} baseUrl - base url string
   * @param {Object} child - child object can be of type itemGroup or request
   * @param {Object} globalParameters - Object with parameters given at root level of raml spec
   * @param {Object} options - Options to customize generated postman collection
   * @param {Array} pathVariables - Array with all path variables in relative baseUrl and it's value and decription.
   * @returns {*} Postman itemGroup or request
   * @no-unit-test
   */
  convertChildToItemGroup: function(baseUrl, child, globalParameters, options, pathVariables = []) {
    var resource = child,
      itemGroup,
      subChild,
      i,
      url,
      // used to store url after path variables of url is resolved
      convertedBaseUrl = _.cloneDeepWith(baseUrl),
      displayName = _.get(resource, 'resourceInfo.displayName', resource.name),
      relativeUrl = _.get(resource, 'resourceInfo.relativeUri', ''),
      requestCount,
      convertedUrlAndVars = helper.addParametersToUrl(
        _.get(resource, 'resourceInfo.relativeUri', ''),
        _.get(resource, 'resourceInfo.uriParameters', []),
        globalParameters.types
      );

    url = baseUrl.value + convertedUrlAndVars.url;
    pathVariables = _.concat(pathVariables, convertedUrlAndVars.variables);
    // replace current url with resolved path variable one
    convertedBaseUrl.value = url;

    // Add resource traits to it's child methods and resources
    if (_.has(resource, 'resourceInfo.is')) {
      _.forEach(resource.requests, (request) => {
        request.method.is = _.concat(
          _.isArray(request.method.is) ? request.method.is : [],
          _.get(resource, 'resourceInfo.is', [])
        );
      });

      _.forEach(resource.children, (child) => {
        child.resourceInfo.is = _.concat(
          _.isArray(child.resourceInfo.is) ? child.resourceInfo.is : [],
          _.get(resource, 'resourceInfo.is', [])
        );
      });
    }

    // 3 options:

    // 1. folder with more than one request in its subtree or not collapsible
    if (resource.requestCount > 1 || !resource.collapsible) {
      // only return a Postman folder if this folder has>1 children in its subtree or it's not collapsible
      // otherwise we can end up with 10 levels of unwanted folders with 1 request in the end
      itemGroup = new SDK.ItemGroup({
        name: displayName === relativeUrl ? resource.name : displayName,
        description: _.get(resource, 'resourceInfo.description', '')
      });

      // If a folder has only one child and can be collapsed then we collapse the child folder
      // with parent folder.
      if (resource.childCount === 1 && resource.collapsible) {
        let subChild = Object.keys(resource.children)[0],
          resourceSubChild = resource.children[subChild];

        resourceSubChild.name = resource.name + '/' + resourceSubChild.name;

        return this.convertChildToItemGroup(
          convertedBaseUrl, resourceSubChild, globalParameters, options, pathVariables
        );
      }
      // recurse over child leaf nodes
      // and add as children to this folder
      for (i = 0, requestCount = resource.requests.length; i < requestCount; i++) {
        itemGroup.items.add(
          this.convertRequestToItem(resource.requests[i].method, url, globalParameters, options, pathVariables)
        );
      }

      // recurse over child folders
      // and add as child folders to this folder
      for (subChild in resource.children) {
        if (resource.children.hasOwnProperty(subChild) && resource.children[subChild].requestCount > 0) {
          itemGroup.items.add(
            this.convertChildToItemGroup(
              convertedBaseUrl, resource.children[subChild], globalParameters, options, pathVariables
            )
          );
        }
      }

      return itemGroup;
    }

    // 2. it has only 1 direct request of its own
    if (resource.requests.length === 1) {
      return this.convertRequestToItem(resource.requests[0].method, url, globalParameters, options, pathVariables);
    }

    // 3. it's a folder that has no child request
    // but one request somewhere in its child folders
    for (subChild in resource.children) {
      if (resource.children.hasOwnProperty(subChild) && resource.children[subChild].requestCount === 1) {
        if (displayName === relativeUrl) {
          // Change resource name to append parent folder name in child's folder name
          resource.children[subChild].name = resource.name +
            _.get(resource.children[subChild], 'resourceInfo.displayName');
        }

        return this.convertChildToItemGroup(
          convertedBaseUrl,
          resource.children[subChild],
          globalParameters,
          options,
          pathVariables
        );
      }
    }
  },

  /**
   *
   * Generates a Trie structure from the resources object of the RAML 1.0 specification. (Recursive)
   *
   * @param {Trie} trie - trie data structure
   * @param {Object} resources - raml resources
   * @param {Object} globalParameters - some root level parameters (i.e. baseUrl, securitySchema etc)
   * @param {Object} options - Options to customize generated postman collection
   * @returns {void}
   */
  generateTrieFromResources: function (trie, resources, globalParameters, options) {
    var currentPath = '',
      pathLength,
      currentNode,
      isCollapsible,
      path,
      i;

    _.forEach(resources, (resource) => {

      // resource path of current resource relative to baseUri
      path = _.get(resource, 'absoluteUri', '').replace(globalParameters.baseUri, '');

      // discard the leading slash, if it exists
      if (path[0] === '/') {
        path = path.substring(1);
      }

      // split the path into indiv. segments for trie generation
      // unless path it the root endpoint
      currentPath = path === '' ? ['(root)'] : path.split('/').filter((pathItem) => {
        // remove any empty pathItems that might have cropped in
        // due to trailing or double '/' characters
        return pathItem !== '';
      });

      // If resource has displayName or description of it's own than don't collapse folders
      isCollapsible = _.get(resource, 'displayName', null) === resource.relativeUri && !_.has(resource, 'description');
      pathLength = currentPath.length;
      currentNode = trie.root;

      // adding children for the nodes in the trie
      // start at the top-level and do a DFS
      for (i = 0; i < pathLength; i++) {
        if (!currentNode.children[currentPath[i]]) {
          // if the currentPath doesn't already exist at this node, add it as a folder
          currentNode.addChildren(currentPath[i], new Node({
            name: currentPath[i],
            // set resourse specific properties only for last path of resource
            resourceInfo: (i === pathLength - 1) ? _.omit(resource, ['resources', 'methods', '__METADATA__']) : {},
            collapsible: (i === pathLength - 1) && isCollapsible,
            requestCount: 0,
            requests: [],
            children: {},
            type: 'item-group',
            childCount: 0
          }));

          // We are keeping the count children in a folder which can be a request or folder
          // For ex- In case of /pets/a/b, pets has 1 childCount (i.e a)
          currentNode.childCount += 1;
        }
        // requestCount increment for the node we just added
        currentNode.children[currentPath[i]].requestCount += _.get(resource, 'methods.length', 0);
        currentNode = currentNode.children[currentPath[i]];
      }

      // add methods to node
      _.each(resource.methods, (method) => {
        currentNode.addMethod({
          name: method.method,
          method: method,
          type: 'item'
        });
        currentNode.childCount += 1;
      });

      // Recursive strategy needed as nested resources are allowed in RAML
      if (resource.resources) {
        helper.generateTrieFromResources(trie, resource.resources, globalParameters, options);
      }
    });

    return null;
  }
};

module.exports = helper;
