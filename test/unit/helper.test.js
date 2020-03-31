var expect = require('chai').expect,
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
});
