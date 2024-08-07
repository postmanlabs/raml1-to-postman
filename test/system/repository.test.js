/**
 * @fileOverview This test specs runs tests on the package.json file of repository. It has a set of strict tests on the
 * content of the file as well. Any change to package.json must be accompanied by valid test case in this spec-sheet.
 */
const expect = require('chai').expect,
  fs = require('fs');

/* global describe, it */
describe('project repository', function () {
  describe('package.json', function () {
    let content,
      json;

    it('must exist', function (done) {
      fs.stat('./package.json', done);
    });

    it('must have readable content', function () {
      expect(content = fs.readFileSync('./package.json').toString()).to.be.ok;
    });

    it('content must be valid JSON', function () {
      expect(json = JSON.parse(content)).to.be.ok;
    });

    describe('package.json JSON data', function () {
      it('must have valid name, description and author', function () {
        expect(json.name).to.equal('raml1-to-postman');
        expect(json.description)
          .to.equal('Converts RAML 1.0 files to postman v2 collection');
        expect(json.author).to.equal('Postman Labs <help@getpostman.com>');
        expect(json.license).to.equal('Apache-2.0');
      });

      it('must have a valid version string in form of <major>.<minor>.<revision>', function () {
        // eslint-disable-next-line max-len
        expect(json.version).to.match(/^((\d+)\.(\d+)\.(\d+))(?:-([\dA-Za-z\-]+(?:\.[\dA-Za-z\-]+)*))?(?:\+([\dA-Za-z\-]+(?:\.[\dA-Za-z\-]+)*))?$/);

      });
    });

    describe('dependencies', function () {
      it('must exist', function () {
        expect(json.dependencies).to.be.a('object');
      });

      it('should have a valid version string in form of <major>.<minor>.<revision>', function () {
        expect(json.version)
          // eslint-disable-next-line max-len, security/detect-unsafe-regex
          .to.match(/^((\d+)\.(\d+)\.(\d+))(?:-([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?(?:\+([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?$/);
      });
    });

    describe('devDependencies', function () {
      it('must exist', function () {
        expect(json.devDependencies).to.be.a('object');
      });

      it('should point to a valid semver', function () {
        Object.keys(json.devDependencies).forEach(function (dependencyName) {
          // eslint-disable-next-line security/detect-non-literal-regexp
          expect(json.devDependencies[dependencyName]).to.match(new RegExp('((\\d+)\\.(\\d+)\\.(\\d+))(?:-' +
            '([\\dA-Za-z\\-]+(?:\\.[\\dA-Za-z\\-]+)*))?(?:\\+([\\dA-Za-z\\-]+(?:\\.[\\dA-Za-z\\-]+)*))?$'));
        });
      });
    });

    describe('main entry script', function () {
      it('must point to a valid file', function () {
        expect(json.main).to.equal('index.js');
        expect(fs.existsSync(json.main)).to.be.ok;
      });
    });
  });

  describe('README.md', function () {
    it('must exist', function () {
      expect(fs.existsSync('./README.md')).to.be.ok;
    });

    it('must have readable content', function () {
      expect(fs.readFileSync('./README.md').toString()).to.be.ok;
    });
  });

  describe('CONTRIBUTING.md', function () {
    it('must exist', function () {
      expect(fs.existsSync('./CONTRIBUTING.md')).to.be.ok;
    });

    it('must have readable content', function () {
      expect(fs.readFileSync('./CONTRIBUTING.md').toString()).to.be.ok;
    });
  });

  describe('LICENSE.md', function () {
    it('must exist', function () {
      expect(fs.existsSync('./LICENSE.md')).to.be.ok;
    });

    it('must have readable content', function () {
      expect(fs.readFileSync('./LICENSE.md').toString()).to.be.ok;
    });
  });

  describe('.gitignore file', function () {
    it('must exist', function () {
      expect(fs.existsSync('./.gitignore')).to.be.ok;
    });

    it('must have readable content', function () {
      expect(fs.readFileSync('./.gitignore').toString()).to.be.ok;
    });
  });

  describe('.npmignore file', function () {
    it('must exist', function () {
      expect(fs.existsSync('./.npmignore')).to.be.ok;
    });
  });
  describe('.eslintrc', function () {
    let stripJSON = require('strip-json-comments'),
      content,
      json;

    it('must exist', function (done) {
      fs.stat('./.eslintrc', done);
    });

    it('must have readable content', function () {
      expect(content = fs.readFileSync('./.eslintrc').toString()).to.be.ok;
    });

    it('must be valid JSON content', function () {
      expect(json = JSON.parse(stripJSON(content))).to.be.ok;
    });

    it('must have appropriate plugins specified', function () {
      expect(json.plugins).to.eql(['security', 'jsdoc', 'mocha']);
    });

    it('must have appropriate environments specified', function () {
      expect(json.env.browser).to.equal(false);
      expect(json.env.node).to.equal(true);
      expect(json.env.es6).to.equal(true);
    });
  });
});
