const SDK =  require('postman-collection'),
    jsf = require('json-schema-faker');

jsf.option({
    alwaysFakeOptionals: true
});

//returns the schema for body with examples
function getBodySchema(body, types) {
    let properties,
        type,
        typeProperties,
        schema = {};

    if(body.example) {
      schema = body.example;
    }
    else {
      properties = body.properties || {};

      if(body.type && body.type[0] !== 'object') {
          type = body.type[0];
          typeProperties = types[type].properties;
      }
      Object.assign(properties, typeProperties);
      schema.properties = properties;

      schema = jsf(schema);
    }

    return schema;
}

/* creates an object for raml types to be easily accessible whenever required*/
function createTypesObject(typesArray) {
    let types = {};

    for(var index in typesArray) {
        let type = typesArray[index],
            typeName;

        for(var first in type) {
            typeName = first;
        }
        types[typeName] = typesArray[index][typeName];
    }

    return types;
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
    convertHeader: function(header) {
        let converted_header = new SDK.Header();

        converted_header.key = header.name;
        header.example && (converted_header.value = header.example);
        header.description && (converted_header.description = header.description);

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
        }

        return res;
    },

//returns a url query string constructed from raml query parameters
    constructQueryStringFromQueryParams: function(queryParameters) {
        let params,
            SDKUrl = new SDK.Url();

        for(var param in queryParameters) {
            params = new SDK.QueryParam(param);
            SDKUrl.addQueryParams(params);
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

//converts a raml method into postman item
    convertMethod: function(method, url, globalParameters, types) {
        let item = new SDK.Item(),
            request = new SDK.Request();

        globalParameters && (request.headers.add(helper.getContentTypeHeader(globalParameters.mediaType)));

        method.queryParameters && (url = url.concat(helper.constructQueryStringFromQueryParams(method.queryParameters)));
        method.queryString && (url = url.concat(helper.constructQueryString(method.queryString, types)));

        method.description && ( item.description = (method.description) );
        method.body && (request.body = new SDK.RequestBody({
            mode: 'raw',
            raw: JSON.stringify(helper.convertBody(method.body, types, request))
        }));
        method.responses && ( item.responses.add(helper.convertResponse(method.responses, types)) );

        request.url = url;
        request.method = method.method;
        for (var header in method.headers) {
            request.headers.add(helper.convertHeader(method.headers[header]));
        }
        item.request = request;

        return item;
    },

//add parameters to url in postman specified format
    addParametersToUrl: function(baseUrl, params) {
        let paramString,
            url;

        for(var param in params) {
            paramString = '{' + param + '}';
            url = baseUrl.replace(paramString, ':'+ param);
        }

        return url;
    },

//converts raml resources to postman folders
    convertResources: function(baseUrl, res, globalParameters) {
        let folder = new SDK.ItemGroup(),
            types = createTypesObject(globalParameters.types),
            url;

        url = '{{' + baseUrl.key + '}}' + helper.addParametersToUrl(res.displayName, res.uriParameters);
        res.displayName && ( folder.name = res.displayName );
        res.methods && res.methods.forEach( function (method) {
            folder.items.add(helper.convertMethod(method, url, globalParameters, types));
        });
        res.resources && folder.items.add(helper.convertResources(res.resources, globalParameters));

        return folder;
    }
};

module.exports = helper;
