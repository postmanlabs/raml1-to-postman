const SDK =  require('postman-collection'),
    jsf = require('json-schema-faker');

jsf.option({
  alwaysFakeOptionals: true
});

function setSchema(body, types) {
  let schema = '';

  body.properties && (schema = body.properties);
    if(body.type && schema === '') {
      type = body.type[0];
      schema = types[type];
    }

    return schema;
};

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
};

var helper = {

    setCollectionInfo: function(info, coll) {
      let collection = coll;

      collection.name = info.title;
      collection.version = info.version;
      collection.description = info.documentation.concat(info.description);

      return collection;
    },

    convertHeader: function(header) {
        let converted_header = new SDK.Header();

        converted_header.key = header.name;
        header.example && (converted_header.value = header.example);
        header.description && (converted_header.description = header.description);

        return converted_header;
    },

    createBody: function(ramlBody, types, request) {
      let body,
        schema;

      if(ramlBody['application/json']) {
        request && helper.addContentTypeHeader('application/json', request)
        schema = setSchema(ramlBody['application/json'], types);
      }
      else {
        schema = setSchema(ramlBody, types);
      }

      schema && (body = jsf(schema));

      return body;
    },

    convertResponse: function(response, types) {
      let res = new SDK.Response();

      for(var code in response) {
        res.code = response[code].code;
        res.name = response[code].name || response[code].code;
        response[code].body && (res.body = JSON.stringify(helper.createBody(response[code].body, types, null)));
      }

      return res;
    },

    addQueryParamsToUrl: function(url, queryParameters) {
        let params,
          SDKUrl = new SDK.Url(url);

        for(var param in queryParameters) {
            params = new SDK.QueryParam(param);
            SDKUrl.addQueryParams(params);
        }

        url = url + '?' + SDKUrl.getQueryString();

        return url;
    },

    addQueryStringToUrl: function (url, queryString, types) {

        if(typeof queryString === 'string') {
          url = url.concat(queryString);
        }
        else {
          let typeArray = queryString.type,
            schema,
            SDKUrl = new SDK.Url(url);

          for(var type in typeArray) {
            for(var property in types[typeArray[type]].properties) {
                SDKUrl.addQueryParams(property);
            }
          }
          url = url + '?' + SDKUrl.getQueryString();
        }

        return url;
    },

    addContentTypeHeader: function(mediaType, request) {

      mediaType && request.headers.add(
                      new SDK.Header({
                        key: 'Content-Type',
                        value: mediaType
                      }));

      return request;
    },

    convertMethod: function(method, url, globalParameters, types) {
        let item = new SDK.Item(),
            request = new SDK.Request(),
            auth = new SDK.RequestAuth(),
            queryParameters;

        globalParameters && (request = helper.addContentTypeHeader(globalParameters.mediaType, request));

        method.queryParameters && (url = helper.addQueryParamsToUrl(url, method.queryParameters));
        method.queryString && (url = helper.addQueryStringToUrl(url, method.queryString, types));

        method.description && ( item.description = (method.description) );
        method.body && (request.body = new SDK.RequestBody({
          mode: 'raw',
          raw: JSON.stringify(helper.createBody(method.body, types, request))
        }));
        method.responses && ( item.responses.add(helper.convertResponse(method.responses, types)) );

        request.url = url;
        request.method = method.method;
        for (header in method.headers) {
            request.headers.add(helper.convertHeader(method.headers[header]));
        }
        item.request = request;

        return item;
    },

    addParametersToUrl: function(baseUrl, params) {
      let paramString,
          url;

      for(var param in params) {
        paramString = '{' + param + '}';
        url = baseUrl.replace(paramString, ':'+ param);
      }

      return url;
    },

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
