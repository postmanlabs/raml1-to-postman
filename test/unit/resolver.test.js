var expect = require('chai').expect,
  resolver = require('../../lib/resolver.js');

describe('RESOLVER FUNCTION TESTS ', function() {
  it('resolveTypes Function should return schema with resolved references.', function(done) {
    var ramlTypes = {
        'User': {
          'name': 'User',
          'type': ['object'],
          'properties': {
            'name': {
              'name': 'name',
              'type': ['string'],
              'required': true
            },
            'lastname': {
              'name': 'lastname',
              'type': ['string'],
              'required': true
            }
          }
        },
        'Org': {
          'name': 'Org',
          'type': ['object'],
          'properties': {
            'user': {
              'name': 'user',
              'type': ['User'],
              'required': true
            },
            'address': {
              'name': 'address',
              'type': ['string'],
              'required': false
            },
            'value': {
              'name': 'value',
              'type': ['string'],
              'required': false
            }
          }
        },
        'Office': {
          'name': 'Office',
          'type': ['array'],
          'items': 'User'
        }
      },
      scalar_output = resolver.resolveTypes({ type: ['boolean'] }, ramlTypes),
      scalar_with_format_output = resolver.resolveTypes({ type: ['number'], format: 'int32' }, ramlTypes),
      object_output = resolver.resolveTypes({ type: ['User'] }, ramlTypes),
      nested_object_output = resolver.resolveTypes({ type: ['Org'] }, ramlTypes),
      array_output = resolver.resolveTypes({ type: ['Office'] }, ramlTypes);

    expect(scalar_output).to.deep.include({
      type: 'boolean',
      default: '<boolean>'
    });
    expect(scalar_with_format_output).to.deep.include({
      type: 'number',
      default: '<int32>'
    });
    expect(object_output).to.deep.include({
      type: 'object',
      properties: {
        name: { type: 'string', default: '<string>', required: true },
        lastname: { type: 'string', default: '<string>', required: true }
      }
    });
    expect(nested_object_output).to.deep.include({
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string', default: '<string>', required: true },
            lastname: { type: 'string', default: '<string>', required: true }
          }
        },
        address: { type: 'string', default: '<string>', required: false },
        value: { type: 'string', default: '<string>', required: false }
      }
    });
    expect(array_output).to.deep.include({
      type: 'array',
      maxItems: 2,
      minItems: 2,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', default: '<string>', required: true },
          lastname: { type: 'string', default: '<string>', required: true }
        }
      }
    });
    done();
  });
});
