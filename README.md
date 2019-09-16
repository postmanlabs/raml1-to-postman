
![postman icon](https://raw.githubusercontent.com/postmanlabs/postmanlabs.github.io/develop/global-artefacts/postman-logo%2Btext-320x132.png) 

*Supercharge your API workflow.*  
*Modern software is built on APIs. Postman helps you develop APIs faster.*

# RAML 1.0 to Postman Collection Converter

This module is used to convert RAML 1.0 API schema to Postman Collection v2.

## Getting Started
 To get a copy on your local machine
```bash
$ git clone git@github.com:postmanlabs/raml1-to-postman.git
```


#### Prerequisites
To run this repository, ensure that you have NodeJS >= v4. A copy of the NodeJS installable can be downloaded from https://nodejs.org/en/download/package-manager.

#### Installing dependencies
```bash
$ npm install;
```

## Using the Module
This module exposes two function `convert()` and `validate()`

### Convert

Convert function converts the RAML string into a postman collection.

It requires 1 mandatory parameter:

* `ramlString` - string in a valid RAML 1.0 format.

#### Example
```javascript
var ramlString = `#%RAML 1.0
      title: GitHub API
      version: v3
      baseUri: https://api.github.com
      mediaType:  application/json
      /search:
        /code:
          type: collection
          get:`,
    collection;

collection = convert(ramlString);
```

### Validate

This function is used to check whether or not this converter can be used for the given input. The input is a RAML string. A valid RAML string begin with a REQUIRED YAML-comment line that indicates the RAML version, as follows:
```javascript
#%RAML 1.0
title: My API
```

The result is an object: {result: true/false, reason: 'string'}.



### Notes

This version of converter does not handle the following:

* Libraries, overlays and extensions.

* MediaType other than json.

* Inheritance in types, resourcetypes and traits.

### Resources

* Raml 1.0 official documentation (https://github.com/raml-org/raml-spec/blob/master/versions/raml-10/raml-10.md)

## Running the tests

```bash
$ npm test
```

### Break down into unit tests

```bash
$ npm run test-unit
```
