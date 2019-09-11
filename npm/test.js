#!/usr/bin/env node
require('shelljs/global');
require('colors');

const prettyms = require('pretty-ms'),
  startedAt = Date.now();

require('async').series([
  require('./test-lint'),
  require('./test-system'),
  require('./test-unit')
],
function (code) {
  console.info(
    `\session-util: duration ${prettyms(Date.now() - startedAt)}\nsso-util: ${code ? 'not ok' : 'ok'}!`[code ?
      'red' : 'green']
  );

  exit(code && (typeof code === 'number' ? code : 1) || 0);
});
