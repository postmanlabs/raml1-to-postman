var _ = require('lodash'),
  expect = require('chai').expect,
  helper = require('../../lib/helper.js');

describe('HELPER FUNCTION TESTS ', function() {
  it('convertResponse function should return null body response as default', function(done) {
    var convertedResponse = helper.convertResponse([
      {
        'body': {
          '200': {
            // a valid media type of body should be specified
          }
        }
      }
    ], {}, {}, {});

    expect(convertedResponse).to.be.an('array');
    expect(convertedResponse[0]).to.have.any.keys('name', 'code', 'header', 'body');
    expect(convertedResponse[0].body).to.be.null;
    done();
  });

  it('convertResponse function should return valid responses for multiple response with same status code',
    function(done) {
      var convertedResponses = helper.convertResponse({
        '200': [
          {
            code: '200',
            name: 'Success 1',
            body: {}
          },
          {
            code: '200',
            name: 'Success 2',
            body: {}
          }
        ],
        '400': {
          code: '400',
          name: 'Failure',
          body: {}
        }
      }, {}, {}, {});

      expect(convertedResponses).to.be.an('array');
      expect(convertedResponses.length).to.eql(3);
      expect(convertedResponses[0].code).to.eql(200);
      expect(convertedResponses[0].name).to.eql('Success 1');
      expect(convertedResponses[1].code).to.eql(200);
      expect(convertedResponses[1].name).to.eql('Success 2');
      expect(convertedResponses[2].code).to.eql(400);
      expect(convertedResponses[2].name).to.eql('Failure');
      _.forEach(convertedResponses, (convertedResponse) => {
        expect(convertedResponse).to.have.any.keys('name', 'code', 'headers', 'body');
        expect(convertedResponse.body).to.be.null;
      });
      done();
    });
});
