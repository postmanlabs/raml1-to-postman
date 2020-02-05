<a href="https://www.getpostman.com/"><img src="https://assets.getpostman.com/common-share/postman-logo-horizontal-320x132.png" /></a><br />
_Manage all of your organization's APIs in Postman, with the industry's most complete API development environment._

*Supercharge your API workflow.*  
*Modern software is built on APIs. Postman helps you develop APIs faster.*

# RAML 1.0 to Postman Collection Converter &nbsp; [![Build Status](https://travis-ci.com/postmanlabs/postman-code-generators.svg?branch=master)](https://travis-ci.com/postmanlabs/code-generators)

This module is used to convert RAML 1.0 API schema to Postman Collection v2.

#### Contents 

1. [Getting Started](#getting-started)
2. [Using the converter as a NodeJS module](#using-the-converter-as-a-nodejs-module)
    1. [Convert Function](#convert)
    2. [Options](#options)
    3. [ConversionResult](#conversionresult)
    4. [Sample usage](#sample-usage)
    5. [Validate function](#validate-function)
3. [Notes](#notes)
4. [Resources](#resources)

---

## Getting Started

To use the converter as a Node module, you need to have a copy of the NodeJS runtime (>= v6). The easiest way to do this is through npm. If you have NodeJS installed you have npm installed as well.

```terminal
$ npm install raml1-to-postman
```

## Using the converter as a NodeJS module

In order to use the converter in your node application, you need to import the package using `require`.

```javascript
var Converter = require('raml1-to-postman')
```

The converter provides the following functions:

### Convert

The convert function takes in your RAML 1.0 specification and converts it to a Postman collection.

Signature: `convert (data, options, callback);`

**data:**

```javascript
{ type: 'file', data: 'filepath' }
OR
{ type: 'string', data: '<entire RAML 1.0 Specification string>' }
OR
{ type: 'folder', data: [Array of Objects with fileName property and file-path as it's value] }
```

**options:**
```javascript
{
  collapseFolders: true,
  requestParametersResolution: 'schema',
  exampleParametersResolution: 'example'
}
/*
All three properties are optional. Defaults will be used for no options provided. Check the options section below for possible values for each option..
*/
```

**callback:**
```javascript
function (err, result) {
  /*
  result = {
    result: true,
    output: [
      {
        type: 'collection',
        data: {..collection object..}
      }
    ]
  }
  */
}
```

### Options:
* `'collapseFolders'(boolean)`:  Determines whether the importer should attempt to collapse redundant folders into one. Folders are redundant if they have only one child element, and don't have any folder-level data to persist. Default: `true`
* `'requestParametersResolution'(string)`: Determines how request parameters (query parameters, path parameters, headers, or the request body) should be generated. Setting this to `schema` will cause the importer to use the parameter's schema as an indicator; `example` will cause the example (if provided) to be picked up. Default: `schema`
* `'exampleParametersResolution'(string)`: Determines how response parameters (query parameters, path parameters, headers, or the request body) should be generated. Setting this to schema will cause the importer to use the parameter's schema as an indicator; `example` will cause the example (if provided) to be picked up. Default: `exapmle`


### ConversionResult

- `result` - Flag responsible for providing a status whether the conversion was successful or not 

- `reason` - Provides the reason for an unsuccessful conversion, defined only if result: false

- `output` - Contains an array of Postman objects, each one with a `type` and `data`. The only type currently supported is `collection`.



### Sample Usage:
```javascript
var fs = require('fs'),

Converter = require('raml1-to-postman'),
ramlSpec = fs.readFileSync('sample-spec.raml', {encoding: 'UTF8'});

Converter.convert({ type: 'string', data: ramlSpec },
  {}, (err, conversionResult) => {
    if (!conversionResult.result) {
      console.log('Could not convert', conversionResult.reason);
    }
    else {
      console.log('The collection object is: ', conversionResult.output[0].data);
    }
  }
);
```

### Validate Function

The validate function is meant to ensure that the data that is being passed to the convert function is a valid RAML 1.0 Spec.

The validate function is synchronous and returns a status object which conforms to the following schema

#### Validation object schema

```javascript
{
  type: 'object',
  properties: {
    result: { type: 'boolean'},
    reason: { type: 'string' }
  },
  required: ['result']
}
```

##### Validation object explanation
- `result` - true if the data looks like RAML 1.0 and can be passed to the convert function

- `reason` - Provides a reason for an unsuccessful validation of the specification

### Notes

This version of converter does not handle the following yet:

* Libraries, Overlays and Extensions.
* Annotations.

### Resources

* Raml 1.0 official documentation (https://github.com/raml-org/raml-spec/blob/master/versions/raml-10/raml-10.md)
