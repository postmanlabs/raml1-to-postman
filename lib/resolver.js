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
  // Properties added by raml-1-parser that is not required in converted schema
  propertiesToOmit = ['__METADATA__', 'typePropertyKind', 'name', 'displayName'];

module.exports = {

  /**
   * Resolves RAML types array.
   *
   * In RAML types spec:
   * | stands for OR
   * , stands for AND (Can be considered as different array elements)
   *
   * @param {Array} typeArray - RAML 1.0 types array
   *
   * @returns {Array} Union types resolved array.
   */
  resolveTypesArray: function (typeArray) {
    var resolvedType = [];

    // Here OR will be resolved into first type i.e Union type Dog | Cat will be treated as Dog for resolving schema.
    _.forEach(typeArray, (type) => {
      resolvedType.push(_.trim(_.split(type, '|', 1)[0]));
    });

    return resolvedType;
  },

  /**
   * Resolves Union type of RAML by adding properties of types present in union type
   *
   * @param {Object} schema - RAML schema of a type
   * @param {Array} types - Defined types in RAML spec.
   * @param {Integer} stack - counter which keeps a tab on nested schemas
   *
   * @returns {Object} Resolved object containig properties of types present in union
   */
  resolveUnion: function (schema, types, stack = 0) {
    // generate one object for each type
    let allTypes = schema.type.map((type) => {
        if (types[type]) {
          return this.resolveTypes(types[type], types, stack);
        }

        return this.resolveTypes(type, types, stack);
      }).filter((schema) => {
        return schema.type === 'object';
      }),

      // generated object with properties from union of all types which we return
      finalObject = {
        type: 'object',
        name: schema.name,
        required: schema.required || false,
        properties: {}
      },

      // set of properties which we've already handled, to avoid repitition
      handledProps = {},
      i,
      j;

    for (i = 0; i < allTypes.length; i++) {
      // go through all types, and add to finalObject if not in handledProps
      for (j in allTypes[i].properties) {
        if (allTypes[i].properties.hasOwnProperty(j) && !handledProps[j]) {
          handledProps[j] = true;
          finalObject.properties[j] = allTypes[i].properties[j];
        }
      }
    }

    return finalObject;
  },

  /**
   * Resolves references to types for a given schema.
   * @param {Object} schema RAML schema to resolve types.
   * @param {Array} types Defined types in RAML spec.
   * @param {Integer} stack counter which keeps a tab on nested schemas
   *
   * @returns {Object} schema satisfying JSON-schema-faker.
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
    schema.type = this.resolveTypesArray(schema.type);

    if (schema.type.length > 1) {
      return this.resolveUnion(schema, types, stack);
    }

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
          // Resolve it to same as given input instead Invalid type
          schema.default = schema.type[0];
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
