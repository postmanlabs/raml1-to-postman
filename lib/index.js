var converter = require('./convert'),
    fs = require('fs');

module.exports = {
    convert: function(input, options, cb) {
        try {
            var data, collection;

            if (input.type === 'file') {
                data = fs.readFileSync(input.data).toString();
            }
            else if (input.type === 'string') {
                data = input.data;
            }
            else {
                return cb(null, {
                    result: false,
                    reason: 'input type is not valid'
                });
            }
            collection = converter.convert(data);

            return cb(null, {
                result: true,
                output: [
                    {
                        type: 'collection',
                        data: collection
                    }
                ]

            });
        }
        catch (e) {
            cb(e);
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
