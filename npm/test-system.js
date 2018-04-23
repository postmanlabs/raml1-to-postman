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
        },

        /**
         * Execute nsp checks on project dependencies. In-program usage of nsp is a bit tricky as we have to emulate the
         * cli script's usage of internal nsp functions.
         */
        function (next) {
            var nsp = require('nsp'),
                pkg = loadJSON('../package.json'),
                nsprc = loadJSON('../.nsprc');

            console.info('processing nsp for security vulnerabilities...\n');

            // we do not pass full package for privacy concerns and also to add the ability to ignore exclude packages,
            // hence we customise the package before we send it
            nsp.check({
                offline: false,
                package: _.merge({
                    dependencies: _.omit(pkg.dependencies, nsprc.exclusions || [])
                }, _.pick(pkg, ['name', 'version', 'homepage', 'repository']))
            }, function (err, result) {
                // if processing nsp had an error, simply print that and exit
                if (err) {
                    console.error(('There was an error processing NSP!\n').red + (err.message || err).gray +
                    '\n\nSince NSP server failure is not a blocker for tests, tests are not marked as failure!');
                    return next();
                }

                // in case an nsp violation is found, we raise an error
                if (result.length) {
                    console.error(nsp.formatters.default(err, result));
                    return next(1);
                }

                console.info(('nsp ok!\n').green);
                return next();
            });
        }
    ], exit);
};

// ensure we run this script exports if this is a direct stdin.tty run
!module.parent && module.exports(exit);