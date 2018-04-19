const SDK =  require('postman-collection'),
    jsf = require('json-schema-faker');

jsf.option({
    alwaysFakeOptionals: true
});

var authTypeMap = {
  basic: 'basic',
  oauth_1_0: 'oauth1',
  oauth_2_0: 'oauth2',
  digest: 'digest'
};

//returns the schema for body with examples
function getBodySchema(body, types) {
    let properties,
        type,
        typeProperties,
        schema = {},
        schemaFaker = {};

    if(body.example) {
      schema = body.example;
    }
    else if(body.examples) {
      for(var first in body.examples) {
        schema = body.examples[first].structuredValue;
        break;
      }
    }
    else {
      for(var property in body.properties) {
        schemaFaker.properties = body.properties[property];
        schema[property] = body.properties[property].default ||
          body.properties[property].example ||
          jsf(schemaFaker)[property];
      }
      if(body.type && body.type[0] !== 'object') {
          type = body.type[0];
          typeProperties = types[type].properties;
          for(var property in typeProperties) {
            schemaFaker.properties = typeProperties[property];
            schema[property] = typeProperties[property].default ||
              typeProperties[property].example ||
              jsf(schemaFaker)[property];
          }
      }
    }

    return schema;
}

var helper = {

//sets the info parameters of collection object
    setCollectionInfo: function(info, coll) {
        let collection = coll;

        collection.name = info.title;
        collection.version = info.version;
        collection.description = info.documentation.concat(info.description);

        return collection;
    },

//converts raml header into postman header
    convertHeader: function(header, types) {
        let converted_header = new SDK.Header();

        converted_header.key = header.name;
        if (header.required !== true) {
          converted_header.disabled = true;
        }
        header.description && (converted_header.description = header.description);
        if(header.type[0] !== 'string' && header.type[0] !== 'integer' && header.type[0] !== 'boolean') {
          converted_header.value = types[header.type[0]].default || types[header.type[0]].example;
        }
        converted_header.value = header.default || header.example || converted_header.value;
        return converted_header;
    },

//converts ramlbody into postman body
    convertBody: function(ramlBody, types) {
        let body;

        if(ramlBody['application/json']) {
            body = getBodySchema(ramlBody['application/json'], types);
        }
        else {
            body = getBodySchema(ramlBody, types);
        }

        return body;
    },

//converts raml response to postman response
    convertResponse: function(response, types) {
        let res = new SDK.Response();

        for(var code in response) {
            res.code = response[code].code;
            res.name = response[code].name || response[code].code;
            response[code].body && (res.body = JSON.stringify(helper.convertBody(response[code].body, types, null)));
            if(response[code].headers) {
              for(var header in response[code].headers) {
                let returnedHeader = helper.convertHeader(response[code].headers[header], types);
                res.headers.add(returnedHeader);
              }
            }
        }

        return res;
    },

//returns a url query string constructed from raml query parameters
    constructQueryStringFromQueryParams: function(queryParameters) {
        let SDKUrl = new SDK.Url();

        for(var param in queryParameters) {
            SDKUrl.addQueryParams(new SDK.QueryParam({
              key : param,
              value : queryParameters[param].default || queryParameters[param].example || ''
            }));
        }

        return ('?' + SDKUrl.getQueryString());
    },

//returns url query string constructed from raml query string
    constructQueryString: function (queryString, types) {

        if(typeof queryString === 'string') {
            return queryString;
        }
        else {
            let typeArray = queryString.type,
                SDKUrl = new SDK.Url(url);

            for(var type in typeArray) {
                for(var property in types[typeArray[type]].properties) {
                    SDKUrl.addQueryParams(property);
                }
            }

            return SDKUrl.getQueryString();
        }
    },

//returns a postman content-type header
    getContentTypeHeader: function(mediaType) {

        return new SDK.Header({
                key: 'Content-Type',
                value: mediaType
            });
    },

    convertSecurityScheme: function(securedBy, securitySchemes) {
      let securityScheme = {};

      securityScheme.type = authTypeMap[securedBy];

      return securityScheme;
    },

//converts a raml method into postman item
    convertMethod: function(method, url, globalParameters) {
        let item = new SDK.Item(),
            request = new SDK.Request(),
            mediaType = globalParameters.mediaType || "application/json",
            securedBy = method.securedBy || globalParameters.securedBy;

        method.queryParameters && (url = url.concat(helper.constructQueryStringFromQueryParams(method.queryParameters)));
        method.queryString && (url = url.concat(helper.constructQueryString(method.queryString, globalParameters.types)));

        method.description && ( item.description = (method.description) );
        method.body && (request.body = new SDK.RequestBody({
            mode: 'raw',
            raw: JSON.stringify(helper.convertBody(method.body, globalParameters.types, request))
        })) && request.headers.add(helper.getContentTypeHeader(mediaType));
        method.responses && ( item.responses.add(helper.convertResponse(method.responses, globalParameters.types)) );
        securedBy && ( request.auth = helper.convertSecurityScheme(securedBy[0], globalParameters.securitySchemes) );
        request.url = url;
        request.method = method.method;
        for (var header in method.headers) {
            request.headers.add(helper.convertHeader(method.headers[header], globalParameters.types));
        }
        item.request = request;

        return item;
    },

//add parameters to url in postman specified format
    addParametersToUrl: function(baseUrl, params, types) {
        let paramToReplace,
            paramToBeReplaced,
            url = baseUrl,
            value,
            type;

        for(var param in params) {
          paramToReplace = param;
          value = params[param].default || params[param].example;
          if(params[param].type[0] !== 'string' && params[param].type[0] !== 'boolean' && params[param].type[0] !== 'integer') {
            type = params[param].type[0];
            value = types[type].default || types[type].example || value;
          }
          value && (paramToReplace = `${param}=${value}/`);
          paramToBeReplaced = '{' + param + '}';
          url = url.replace(paramToBeReplaced, ':'+ paramToReplace);
        }

        return url;
    },

//converts raml resources to postman folders
    convertResources: function(baseUrl, res, globalParameters) {
        var folder = new SDK.ItemGroup(),
            url,
            returnedFolder;

        url = '{{' + baseUrl.key + '}}' + helper.addParametersToUrl(res.displayName, res.uriParameters, globalParameters.types);
        res.displayName && ( folder.name = res.displayName );
        res.methods && res.methods.forEach( function (method) {
            folder.items.add(helper.convertMethod(method, url, globalParameters));
        });

        res.resources && res.resources.forEach( function (resource) {
            folder.items.add(helper.convertResources(baseUrl, resource, globalParameters));
        });

        return folder;
    }
};

module.exports = helper;
