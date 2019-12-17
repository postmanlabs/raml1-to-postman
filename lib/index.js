var converter = require('./convert'),
  _ = require('lodash'),
  async = require('async'),
  fs = require('fs'),
  guessRoot = require('./guessRoot');

module.exports = {
  convert: function(input, options, cb) {
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
    else if (input.type === 'folder') {
      var rootSpecs = guessRoot(input.data),
        convertedSpecs = [];

      if (_.isEmpty(rootSpecs)) {
        return cb(null, {
          result: false,
          reason: 'Imported folder does not contain Root of the RAML 1.0 Specs.'
        });
      }
      else if (rootSpecs.length > 1) {
        return cb(null, {
          result: false,
          reason: 'Imported folder contains multiple Root of the RAML 1.0 Specs.'
        });
      }

      async.each(rootSpecs, (rootSpec, callback) => {
        var content = fs.readFileSync(rootSpec, 'utf8'),
          files = {
            rootFilePath: rootSpec,
            allFilePaths: input.data
          };

        converter.convert(content, options, files, (err, result) => {
          if (err) {
            return callback(err);
          }
          convertedSpecs.push(result);
          callback();
        });
      }, (err) => {
        if (err) {
          return cb(null, {
            result: false,
            reason: _.toString(err)
          });
        }

        return cb(null, convertedSpecs[0]);
      });
    }
    else {
      return cb(null, {
        result: false,
        reason: `input type: ${input.type} is not valid`
      });
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
      else if (input.type === 'folder') {
        if (_.isEmpty(guessRoot(input.data))) {
          return {
            result: false,
            reason: 'Imported folder does not contain Root of the RAML 1.0 Specs.'
          };
        }

        return {
          result: true,
          reason: ''
        };
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

  getOptions: converter.getOptions
};
