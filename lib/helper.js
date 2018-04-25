const SDK = require('postman-collection'),
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
        collection.description = info.documentation.concat(info.description);

        return collection;
    },

    /**
    *
    * Used to convert a raml json header into postman sdk header object
    *
    * @param {Object} header - raml header in json format
    * @param {Object} types - raml types map
    *
    * @returns {Object} converted_header - postman sdk header object
    */
    convertHeader: function(header, types) {
        let converted_header = new SDK.Header();

        converted_header.key = header.name;
        if (header.required !== true) {
            converted_header.disabled = true;
        }
        header.description && (converted_header.description = header.description);

        if (!ramlDefaultDataTypes[header.type[0]]) {
            converted_header.value = types[header.type[0]].default || types[header.type[0]].example;
        }
        converted_header.value = header.default || header.example || converted_header.value;

        return converted_header;
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
    * @returns {Object} res - postman sdk response object
    */
    convertResponse: function(response, types) {
        let res = new SDK.Response(),
            header;

        for (var code in response) {
            if (Object.prototype.hasOwnProperty.call(response, code)) {
                res.code = response[code].code;
                res.name = response[code].name || response[code].code;
                response[code].body &&
                  (res.body = JSON.stringify(helper.convertBody(response[code].body, types, null)));
                if (response[code].headers) {
                    for (header in response[code].headers) {
                        if (Object.prototype.hasOwnProperty.call(response[code].headers, header)) {
                            let returnedHeader = helper.convertHeader(response[code].headers[header], types);

                            res.headers.add(returnedHeader);
                        }
                    }
                }
            }
        }

        return res;
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

        for (var param in queryParameters) {
            if (Object.prototype.hasOwnProperty.call(queryParameters, param)) {
                SDKUrl.addQueryParams(new SDK.QueryParam({
                    key: param,
                    value: queryParameters[param].default || queryParameters[param].example || ''
                }));
            }
        }

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
        let type,
            property,
            typeArray = queryString.type,
            SDKUrl = new SDK.Url();

        if (typeof queryString === 'string') {
            return queryString;
        }

        for (type in typeArray) {
            if (Object.prototype.hasOwnProperty.call(typeArray, type)) {
                for (property in types[typeArray[type]].properties) {
                    if (Object.prototype.hasOwnProperty.call(types[typeArray[type]].properties, property)) {
                        SDKUrl.addQueryParams(property);
                    }
                }
            }
        }

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
    *
    * Used to convert raml method json to a postman sdk item object
    *
    * @param {Object} method - raml method in json format
    * @param {String} url - url of the raml request
    * @param {Object} globalParameters - Object with parameters given at root level of raml spec
    *
    * @returns {Object} item - postman sdk item object
    */
    convertMethod: function(method, url, globalParameters) {
        let item = new SDK.Item(),
            request = new SDK.Request(),
            mediaType = globalParameters.mediaType || 'application/json',
            securedBy = method.securedBy || globalParameters.securedBy;

        method = addTraitsToMethod(method, globalParameters.traits);
        if (method.queryParameters) {
            url = url.concat(helper.constructQueryStringFromQueryParams(method.queryParameters));
        }
        if (method.queryString) {
            url = url.concat(helper.constructQueryString(method.queryString, globalParameters.types));
        }
        method.description && (item.description = (method.description));
        method.body && (request.body = new SDK.RequestBody({
            mode: 'raw',
            raw: JSON.stringify(helper.convertBody(method.body, globalParameters.types, request))
        })) && request.headers.add(helper.getContentTypeHeader(mediaType));
        method.responses && (item.responses.add(helper.convertResponse(method.responses, globalParameters.types)));
        securedBy && (request.auth = helper.convertSecurityScheme(securedBy[0], globalParameters.securitySchemes));
        request.url = url;
        request.method = method.method;
        for (var header in method.headers) {
            if (Object.prototype.hasOwnProperty.call(method.headers, header)) {
                request.headers.add(helper.convertHeader(method.headers[header], globalParameters.types));
            }
        }
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
    * @returns {string} url - postman url string
    */
    addParametersToUrl: function(baseUrl, params, types) {
        let paramToReplace,
            paramToBeReplaced,
            url = baseUrl,
            value,
            type;

        for (var param in params) {
            if (Object.prototype.hasOwnProperty.call(params, param)) {
                paramToReplace = param;
                value = params[param].default || params[param].example;
                if (params[param].type[0] !== 'string' &&
                  params[param].type[0] !== 'boolean' &&
                  params[param].type[0] !== 'integer') {
                    type = params[param].type[0];
                    value = types[type].default || types[type].example || value;
                }
                value && (paramToReplace = `${param}=${value}/`);
                paramToBeReplaced = '{' + param + '}';
                url = url.replace(paramToBeReplaced, ':' + paramToReplace);
            }
        }

        return url;
    },

    /**
    *
    * Used to convert raml resource json to a postman sdk ItemGroup object
    *
    * @param {string} baseUrl - base url string
    * @param {String} res - raml resource json
    * @param {Object} globalParameters - Object with parameters given at root level of raml spec
    *
    * @returns {Object} folder - postman sdk ItemGroup object
    */
    convertResources: function(baseUrl, res, globalParameters) {
        var folder = new SDK.ItemGroup(),
            url;

        url = '{{' + baseUrl.key + '}}' +
          helper.addParametersToUrl(res.displayName, res.uriParameters, globalParameters.types);
        res.displayName && (folder.name = res.displayName);
        res.methods && res.methods.forEach(function (method) {
            folder.items.add(helper.convertMethod(method, url, globalParameters));
        });

        res.resources && res.resources.forEach(function (resource) {
            folder.items.add(helper.convertResources(baseUrl, resource, globalParameters));
        });

        return folder;
    }
};

module.exports = helper;
