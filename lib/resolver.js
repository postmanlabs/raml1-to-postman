const _ = require('lodash'),
  // Supported scalar types by RAML 1.0 Pre-processor
  scalarTypes = {
    string: '<string>',
    number: ['int', 'int8', 'int16', 'int32', 'int64', 'long', 'float', 'double'],
    integer: ['int', 'int8', 'int16', 'int32', 'int64', 'long', 'float', 'double'],
    boolean: '<boolean>',
    'date-only': '<date-only>',
    'time-only': '<time-only>',
    'datetime-only': '<datetime-only>',
    datetime: '<datetime>',
    file: '<file>',
    nil: 'null'
  },
  propertiesToOmit = ['__METADATA__', 'typePropertyKind', 'name', 'displayName', 'required'];

module.exports = {
  /**
   * Resolves references to types for a given schema.
   * @param {*} schema (openapi) to resolve references.
   * @param {*} types types in openapi spec.
   * @param {*} stack counter which keeps a tab on nested schemas
   * @returns {*} schema satisfying JSON-schema-faker.
   */
  resolveTypes: function (schema, types, stack = 0) {
    stack++;
    if (stack > 20) {
      return { value: '<Error: Too many levels of nesting to fake this schema>' };
    }

    // items for type array in raml is only string containing name of type
    if (_.isString(schema) && types[schema]) {
      return this.resolveTypes(types[schema], types, stack);
    }

    schema = _.omit(schema, propertiesToOmit);
    if (types[schema.type[0]]) {
      return this.resolveTypes(types[schema.type[0]], types, stack);
    }

    if (schema.type[0] === 'object' || schema.hasOwnProperty('properties')) {
      let tempSchema;

      // go through all properties
      if (schema.hasOwnProperty('properties')) {
        // shallow cloning schema object except properties object
        tempSchema = _.omit(schema, 'properties');
        tempSchema.properties = {};
        _.forEach(schema.properties, (property, key) => {
          tempSchema.properties[key] = this.resolveTypes(property, types, stack);
        });
        tempSchema.type = 'object';

        return tempSchema;
      }

      schema.type = 'string';
      schema.default = '<object>';
    }
    else if (schema.type[0] === 'array' && schema.items) {
      let tempSchema;

      // This is needed because the schemaFaker doesn't respect options.maxItems/minItems
      schema.maxItems = 2;
      schema.minItems = 2;

      tempSchema = _.omit(schema, 'items');
      tempSchema.items = this.resolveTypes(schema.items, types, stack);
      tempSchema.type = 'array';

      return tempSchema;
    }
    else if (!schema.default) {
      if (schema.hasOwnProperty('type')) {
        if (_.isString(scalarTypes[schema.type[0]])) {
          schema.default = scalarTypes[schema.type[0]];
        }
        else if (_.isArray(scalarTypes[schema.type[0]])) {
          schema.default = _.includes(scalarTypes[schema.type[0]], schema.format) ?
            '<' + schema.format + '>' :
            '<' + schema.type[0] + '>';
        }
        else {
          schema.default = '<Invalid Type>';
        }
        schema.type = schema.type[0];
      }
      else if (schema.enum && schema.enum.length > 0) {
        return {
          type: (typeof (schema.enum[0])),
          value: schema.enum[0]
        };
      }
      else {
        return {
          type: 'string',
          default: '<Invalid Type>'
        };
      }
      if (!schema.type) {
        schema.type = 'string';
      }
      delete schema.format;
    }

    return schema;
  }
};
