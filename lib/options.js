const _ = require('lodash');

module.exports = {
  // default options
  // if mode=document, returns an array of name/id/default etc.

  /**
   * Used in order to get additional options for importing of RAML 1.0 schema
   *
   * name - human-readable name for the option
   * id - key to pass the option with
   * type - boolean or enum for now
   * default - the value that's assumed if not specified
   * availableOptions - allowed values (only for type=enum)
   * description - human-readable description of the item
   *
   * @param {string} [mode='document'] Describes use-case. 'document' will return an array
   * with all options being described. 'use' will return the default values of all options
   * @returns {mixed} An array or object (depending on mode) that describes available options
   */
  getOptions: function (mode = 'document') {
    let optsArray = [
      {
        name: 'Collapse redundant folders',
        id: 'collapseFolders',
        type: 'boolean',
        default: true,
        description: 'Importing will collapse all folders that have only one child element and' +
        ' lack persistent folder-level data.',
        external: true
      },
      {
        name: 'Request parameter generation',
        id: 'requestParametersResolution',
        type: 'enum',
        default: 'Schema',
        availableOptions: ['Example', 'Schema'],
        description: 'Select whether to generate the request parameters based on the schema or the examples.',
        external: true
      },
      {
        name: 'Response parameter generation',
        id: 'exampleParametersResolution',
        type: 'enum',
        default: 'Example',
        availableOptions: ['Example', 'Schema'],
        description: 'Select whether to generate the response parameters based on the schema or the examples.',
        external: true
      }
    ];

    if (mode === 'use') {
      // options to be used as default kv-pairs
      let defOptions = {};

      _.each(optsArray, (opt) => {
        defOptions[opt.id] = opt.default;
      });

      return defOptions;
    }

    // options to be used as documentation
    return optsArray;
  }
};
