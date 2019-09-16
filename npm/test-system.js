#!/usr/bin/env node
require('shelljs/global');
require('colors');

var async = require('async'),
  _ = require('lodash'),
  path = require('path'),
  Mocha = require('mocha'),
  recursive = require('recursive-readdir'),


  SPEC_SOURCE_DIR = './test/system',

  /**
   * Load a JSON from file synchronously, used as an alternative to dynamic requires.
   *
   */
  loadJSON = function (file) {
    return JSON.parse(require('fs').readFileSync(path.join(__dirname, file)).toString());
  };

module.exports = function (exit) {
  // banner line
  console.info(('\nRunning system tests...\n').yellow.bold);

  async.series([

    /**
     * Enforces sanity checks on installed packages via dependency-check.
     */
    function (next) {
      console.log(('checking package dependencies...\n').yellow);

      exec('dependency-check ./package.json --extra --no-dev --missing', next);
    },

    /**
     * Runs system tests on SPEC_SOURCE_DIR using Mocha.
     *
     */
    function (next) {
      console.info('\nrunning system specs using mocha...');

      var mocha = new Mocha();

      recursive(SPEC_SOURCE_DIR, function (err, files) {
        if (err) {
          console.error(err);

          return exit(1);
        }

        files.filter(function (file) {
          return (file.substr(-8) === '.test.js');
        }).forEach(function (file) {
          mocha.addFile(file);
        });

        // start the mocha run
        mocha.run(next);
        mocha = null; // cleanup
      });
    }
  ], exit);
};

// ensure we run this script exports if this is a direct stdin.tty run
!module.parent && module.exports(exit);
