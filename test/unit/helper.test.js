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
            body: {}
          },
          {
            code: '200',
            body: {}
          }
        ],
        '400': {
          code: '400',
          body: {}
        }
      }, {}, {}, {});

      expect(convertedResponses).to.be.an('array');
      expect(convertedResponses.length).to.eql(3);
      _.forEach(convertedResponses, (convertedResponse, index) => {
        expect(convertedResponse).to.have.any.keys('name', 'code', 'headers', 'body');
        (index === 2) ? expect(convertedResponse.code).to.eql(400) : expect(convertedResponse.code).to.eql(200);
        expect(convertedResponse.body).to.be.null;
      });
      done();
    });
});
