var converter = require('./convert'),
  fs = require('fs');

module.exports = {
  convert: function(input, options, cb) {
    try {
      if (input.type === 'file') {
        return fs.readFile(input.data, function(err, data) {
          if (err) {
            return cb(err);
          }

          return converter.convert(data.toString(), options, cb);
        });
      }
      else if (input.type === 'string') {
        return converter.convert(input.data, options, cb);
      }

      return cb(null, {
        result: false,
        reason: `input type: ${input.type} is not valid`
      });
    }
    catch (e) {
      return {
        result: false,
        reason: e.toString()
      };
    }
  },

  validate: function(input) {
    try {
      var data;

      if (input.type === 'file') {
        data = fs.readFileSync(input.data).toString();
      }
      else if (input.type === 'string') {
        data = input.data;
      }
      else {
        return {
          result: false,
          reason: `input type: ${input.type} is not valid`
        };
      }

      return converter.validate(data);
    }
    catch (e) {
      return {
        result: false,
        reason: e.toString()
      };
    }
  },

  /**
   * Used in order to get additional options for importing of RAML 1.0 schema (i.e. )
   *
   * @module getOptions
   *
   * @returns {Array} Options specific to generation of postman collection from RAML 1.0 schema
   */
  getOptions: function () {
    return [
      {
        name: 'Collapse folders',
        id: 'collapseFolders',
        type: 'boolean',
        default: true,
        description: 'Collapse folders with same parent path'
      },
      {
        name: 'Set resolution of types in Request',
        id: 'requestResolution',
        type: 'enum',
        availableOptions: ['Example', 'Schema'],
        default: 'Schema',
        description: 'Option for resolving types in root request body between schema or example'
      },
      {
        name: 'Set resolution of types in Examples',
        id: 'exampleResolution',
        type: 'enum',
        availableOptions: ['Example', 'Schema'],
        default: 'Example',
        description: 'Option for resolving types in example request and response between schema or example'
      }
    ];
  }
};
