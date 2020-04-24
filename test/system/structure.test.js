let expect = require('chai').expect,
  getOptions = require('../../index').getOptions;

const optionIds = [
    'collapseFolders',
    'requestParametersResolution',
    'exampleParametersResolution'
  ],
  expectedOptions = {
    collapseFolders: {
      name: 'Collapse redundant folders',
      type: 'boolean',
      default: true,
      description: 'Importing will collapse all folders that have only one child element and' +
      ' lack persistent folder-level data.'
    },
    requestParametersResolution: {
      name: 'Request parameter generation',
      type: 'enum',
      default: 'Schema',
      availableOptions: ['Example', 'Schema'],
      description: 'Select whether to generate the request parameters based on the' +
      ' [schema](https://github.com/raml-org/raml-spec/blob/master/versions/raml-10/raml-10.md#type-declarations)' +
      ' or the [example]' +
      '(https://github.com/raml-org/raml-spec/blob/master/versions/raml-10/raml-10.md#defining-examples-in-raml).'
    },
    exampleParametersResolution: {
      name: 'Response parameter generation',
      type: 'enum',
      default: 'Example',
      availableOptions: ['Example', 'Schema'],
      description: 'Select whether to generate the response parameters based on the' +
      ' [schema](https://github.com/raml-org/raml-spec/blob/master/versions/raml-10/raml-10.md#type-declarations)' +
      ' or the [example]' +
      '(https://github.com/raml-org/raml-spec/blob/master/versions/raml-10/raml-10.md#defining-examples-in-raml).'
    }
  };

describe('getOptions', function() {
  let options = getOptions();

  it('must be a valid id and should be present in the whitelist of options id', function () {
    options.forEach((option) => {
      expect(option.id).to.be.oneOf(optionIds);
    });
  });

  it('must have a valid structure', function () {
    options.forEach((option) => {
      expect(option).to.have.property('name');
      expect(option).to.have.property('id');
      expect(option).to.have.property('type');
      expect(option).to.have.property('default');
      expect(option).to.have.property('description');
    });
  });

  it('must have consistent type, description and name', function () {
    options.forEach((option) => {
      if (expectedOptions[option.id]) {
        expect(option).to.have.property('description');
        expect(option.name).to.be.eql(expectedOptions[option.id].name);
        expect(option.type).to.be.eql(expectedOptions[option.id].type);
        expect(option.description).to.be.eql(expectedOptions[option.id].description);
      }
      else {
        console.warn(`Option ${option.name} not present in the list of expected options.`);
      }
    });
  });
});
