const _ = require('lodash'),
  wap = require('webapi-parser').WebApiParser,
  UserError = require('./UserError');

/**
 * Validates given RAML 1.0 definition using WebAPI Parser and
 * generates UserError or Unhandled error depending upon type of error.
 *
 * @param {Object} definition - RAML definition
 * @param {*} error - Original Error object
 * @param {Function} cb - Callback function
 * @returns {*} - Generated Error object
 */
function generateError (definition, error, cb) {
  wap.raml10.parse(definition, '')
    .then((model) => {
      wap.raml10.validate(model)
        .then((report) => {
          if (report.conforms || report.results.length === 0) {
            if (error instanceof Error) {
              return cb(error);
            }

            const errorMessage = typeof error === 'string' ? error :
              _.get(error, 'message', 'Failed to generate collection.');

            return cb(new Error(errorMessage));
          }

          let lastReportRes = report.results.pop(),
            message = lastReportRes.message;

          return cb(new UserError(message, error));
        })
        .catch(() => {
          return cb(new UserError('Provided RAML 1.0 definition is invalid.', error));
        });
    })
    .catch(() => {
      return cb(new UserError('Provided RAML 1.0 definition is invalid.', error));
    });
}

module.exports = {
  generateError
};
