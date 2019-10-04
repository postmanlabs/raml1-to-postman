const SDK = require('postman-collection'),
  _ = require('lodash'),
  Node = require('./trie.js').Node,
  jsf = require('json-schema-faker');

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
        (convertedResponse.body = JSON.stringify(helper.convertBody(res.body, types, null)));
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
  * Used to convert raml method to a postman sdk item object
  *
  * @param {Object} method - raml method in json format
  * @param {String} url - url of the raml request
  * @param {Object} globalParameters - Object with parameters given at root level of raml spec
  * @param {Array} pathVariables - Optional path variables array to add value/description of path varibles in url
  *
  * @returns {Object} item - postman sdk item object
  */
  convertRequestToItem: function(method, url, globalParameters, pathVariables) {
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
      raw: JSON.stringify(helper.convertBody(method.body, globalParameters.types, request))
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
   * convert childItem to Postman itemGroup if requestCount(no of requests inside childitem) > 1
   * or it is collapsible folder otherwise return postman request
   *
   * @param {string} baseUrl - base url string
   * @param {Object} child - child object can be of type itemGroup or request
   * @param {Object} globalParameters - Object with parameters given at root level of raml spec
   * @param {Array} pathVariables - Array with all path variables in relative baseUrl and it's value and decription.
   * @returns {*} Postman itemGroup or request
   * @no-unit-test
   */
  convertChildToItemGroup: function(baseUrl, child, globalParameters, pathVariables = []) {
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

        return this.convertChildToItemGroup(convertedBaseUrl, resourceSubChild, globalParameters, pathVariables);
      }
      // recurse over child leaf nodes
      // and add as children to this folder
      for (i = 0, requestCount = resource.requests.length; i < requestCount; i++) {
        itemGroup.items.add(
          this.convertRequestToItem(resource.requests[i].method, url, globalParameters, pathVariables)
        );
      }

      // recurse over child folders
      // and add as child folders to this folder
      for (subChild in resource.children) {
        if (resource.children.hasOwnProperty(subChild) && resource.children[subChild].requestCount > 0) {
          itemGroup.items.add(
            this.convertChildToItemGroup(convertedBaseUrl, resource.children[subChild], globalParameters, pathVariables)
          );
        }
      }

      return itemGroup;
    }

    // 2. it has only 1 direct request of its own
    if (resource.requests.length === 1) {
      return this.convertRequestToItem(resource.requests[0].method, url, globalParameters, pathVariables);
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
   * @returns {void}
   */
  generateTrieFromResources: function (trie, resources, globalParameters) {
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
        helper.generateTrieFromResources(trie, resource.resources, globalParameters);
      }
    });

    return null;
  }
};

module.exports = helper;
