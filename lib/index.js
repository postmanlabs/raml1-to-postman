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

          return converter.convert(data, cb);
        });
      }
      else if (input.type === 'string') {
        return converter.convert(input.data, cb);
      }

      return cb(null, {
        result: false,
        reason: 'input type is not valid'
      });

    }
    catch (e) {
      return cb(e);
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
          reason: 'input type is not valid'
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
  }
};
