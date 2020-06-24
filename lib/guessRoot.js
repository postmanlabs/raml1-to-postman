var _ = require('lodash'),
  fs = require('fs');

/**
 *
 * @param {Array} files - Arrray of file paths
 * @returns {Array} - Array of RAML 1.0 root files
 */
function guessRoot (files) {
  var rootFiles = [];

  _.forEach(files, (file) => {
    // if it is the browser there will be content provided
    // so no need to use fs.readFileSync
    var content = file.content ? file.content : fs.readFileSync(file.fileName, 'utf8').trim(),
      firstLine = content.split('\n')[0].trim();

    if (firstLine === '#%RAML 1.0') {
      rootFiles.push(file);
    }
  });

  return rootFiles;
}

module.exports = guessRoot;
