var expect = require('chai').expect,
  fs = require('fs'),
  _ = require('lodash'),
  Converter = require('../../index.js'),
  VALID_RAML_DIR_PATH = './test/fixtures/valid-raml',
  FIXTURES = _.filter(fs.readdirSync(VALID_RAML_DIR_PATH), (file) => {
    return _.endsWith(file, '.raml');
  }),
  OPTION = { folderPerPathSegment: true },
  HEADER = [
    '#%RAML 1.0',
    'title: T',
    'baseUri: https://x.test',
    'traits:',
    '  paged:',
    '    queryParameters:',
    '      page: { type: integer, default: 1 }',
    'resourceTypes:',
    '  collection:',
    '    get:',
    '      description: List <<resourcePathName>>',
    '    post:',
    '      description: Create <<resourcePathName>>',
    '  readOnly:',
    '    get:',
    '      description: Read <<resourcePathName>>',
    ''
  ].join('\n');

/**
 * @param {String} data - full RAML spec
 * @param {Object} options - converter options
 * @param {Function} cb - called with the conversion result
 * @returns {void}
 */
function convertRaml (data, options, cb) {
  Converter.convert({ type: 'string', data: data }, options, (err, conversionResult) => {
    expect(err).to.be.null;
    // The converter calls back inside its try/catch, which would turn a failed assertion into `result: false`
    setImmediate(() => { cb(conversionResult); });
  });
}

/**
 * @param {String} raml - resources of the spec, appended to HEADER
 * @param {Object} options - converter options
 * @param {Function} cb - called with the collection items
 * @returns {void}
 */
function convert (raml, options, cb) {
  convertRaml(HEADER + raml, options, (conversionResult) => {
    expect(conversionResult.result, conversionResult.reason).to.equal(true);
    cb(conversionResult.output[0].data.item);
  });
}

/**
 * @param {Object} request - collection request
 * @returns {String} `METHOD /path` of the request
 */
function requestKey (request) {
  return request.method + ' /' + _.join(request.url.path, '/');
}

/**
 * Folders become `{ name: [children] }` and requests `METHOD /path`, so one assertion covers placement and URL
 *
 * @param {Array} items - collection items
 * @returns {Array} tree
 */
function tree (items) {
  return _.map(items, (item) => {
    return item.item ? { [item.name]: tree(item.item) } : requestKey(item.request);
  });
}

/**
 * @param {*} value - conversion output
 * @returns {*} copy without the random ids, so two conversions can be compared
 */
function withoutIds (value) {
  return JSON.parse(JSON.stringify(value, (key, val) => {
    return key === 'id' || key === '_postman_id' ? undefined : val;
  }));
}

/**
 * @param {Array} items - collection items
 * @returns {Object} requests keyed by `METHOD /path`
 */
function requestsByKey (items) {
  var requests = {};

  _.forEach(items, (item) => {
    if (item.item) {
      _.assign(requests, requestsByKey(item.item));
    }
    else {
      requests[requestKey(item.request)] = withoutIds(item);
    }
  });

  return requests;
}

/**
 * @param {Array} items - collection items
 * @param {Array} names - folder names from the collection root
 * @returns {Object} the folder at that path
 */
function folderAt (items, names) {
  return _.reduce(names, (folder, name) => {
    return _.find(folder.item, { name: name });
  }, { item: items });
}

/**
 * Converts with and without the option and expects every request to be identical apart from its placement
 *
 * @param {String} raml - resources of the spec, appended to HEADER
 * @param {Function} done - mocha callback
 * @returns {void}
 */
function expectSameRequestsAsDefault (raml, done) {
  convert(raml, {}, (defaultItems) => {
    convert(raml, OPTION, (items) => {
      expect(requestsByKey(items)).to.deep.equal(requestsByKey(defaultItems));
      done();
    });
  });
}

describe('folderPerPathSegment option', function () {
  var SPEC_A = '/orders:\n  get:\n  post:\n',
    SPEC_B = '/orders:\n  post:\n/newres:\n  get:\n';

  describe('folder tree', function () {
    it('should keep a resource with several methods in its folder', function (done) {
      convert(SPEC_A, OPTION, (items) => {
        expect(tree(items)).to.deep.equal([{ orders: ['GET /orders', 'POST /orders'] }]);
        done();
      });
    });

    it('should create a folder for a resource with a single method', function (done) {
      convert(SPEC_B, OPTION, (items) => {
        expect(tree(items)).to.deep.equal([{ orders: ['POST /orders'] }, { newres: ['GET /newres'] }]);
        done();
      });
    });

    it('should create one folder per path segment for nested and flat resources', function (done) {
      convert('/orders:\n  get:\n  /{id}:\n    get:\n    /items:\n      get:\n/a/b/c:\n  get:\n', OPTION, (items) => {
        expect(tree(items)).to.deep.equal([
          { orders: ['GET /orders', { '{id}': ['GET /orders/:id', { items: ['GET /orders/:id/items'] }] }] },
          { a: [{ b: [{ c: ['GET /a/b/c'] }] }] }
        ]);
        done();
      });
    });

    it('should create a folder for a segment that only has a nested resource', function (done) {
      convert('/orders:\n  /{id}:\n    get:\n', OPTION, (items) => {
        expect(tree(items)).to.deep.equal([{ orders: [{ '{id}': ['GET /orders/:id'] }] }]);
        done();
      });
    });

    it('should not create folders for resources without methods', function (done) {
      convert('/empty:\n  description: Nothing here\n/orders:\n  get:\n', OPTION, (items) => {
        expect(tree(items)).to.deep.equal([{ orders: ['GET /orders'] }]);
        done();
      });
    });

    it('should keep requests of the root resource at the collection root', function (done) {
      convert('/:\n  get:\n  post:\n/x:\n  get:\n', OPTION, (items) => {
        expect(tree(items)).to.deep.equal(['GET /', 'POST /', { x: ['GET /x'] }]);
        done();
      });
    });

    it('should take precedence over collapseFolders', function (done) {
      convert(SPEC_B, { folderPerPathSegment: true, collapseFolders: true }, (collapseItems) => {
        convert(SPEC_B, { folderPerPathSegment: true, collapseFolders: false }, (noCollapseItems) => {
          expect(tree(collapseItems)).to.deep.equal([{ orders: ['POST /orders'] }, { newres: ['GET /newres'] }]);
          expect(tree(noCollapseItems)).to.deep.equal(tree(collapseItems));
          done();
        });
      });
    });
  });

  describe('sync', function () {
    it('should keep POST /orders in the orders folder when its sibling GET is removed', function (done) {
      convert(SPEC_A, OPTION, (itemsA) => {
        convert(SPEC_B, OPTION, (itemsB) => {
          expect(_.map(folderAt(itemsA, ['orders']).item, 'request.method')).to.include('POST');
          expect(_.map(folderAt(itemsB, ['orders']).item, 'request.method')).to.deep.equal(['POST']);
          done();
        });
      });
    });

    it('should move POST /orders to the root by default (the behaviour the option avoids)', function (done) {
      convert(SPEC_B, {}, (items) => {
        expect(tree(items)).to.deep.equal(['POST /orders', 'GET /newres']);
        done();
      });
    });
  });

  describe('layout independent of how the RAML is written', function () {
    var NESTED = '/orders:\n  displayName: All Orders\n  get:\n  /{id}:\n    get:\n    /items:\n      get:\n',
      FLAT = '/orders:\n  displayName: All Orders\n  get:\n/orders/{id}:\n  get:\n/orders/{id}/items:\n  get:\n',
      FLAT_CHILD_FIRST = '/orders/{id}/items:\n  get:\n/orders/{id}:\n  get:\n' +
        '/orders:\n  displayName: All Orders\n  get:\n';

    it('should give the same tree for nested resources and flat keys', function (done) {
      convert(NESTED, OPTION, (nestedItems) => {
        convert(FLAT, OPTION, (flatItems) => {
          expect(tree(nestedItems)).to.deep.equal([
            { 'All Orders': ['GET /orders', { '{id}': ['GET /orders/:id', { items: ['GET /orders/:id/items'] }] }] }
          ]);
          expect(tree(flatItems)).to.deep.equal(tree(nestedItems));
          done();
        });
      });
    });

    it('should give the same tree when a flat child is declared before its parent', function (done) {
      convert(NESTED, OPTION, (nestedItems) => {
        convert(FLAT_CHILD_FIRST, OPTION, (flatItems) => {
          // the parent's own requests come first, so only the set of folders and requests is order-independent
          expect(_.map(folderAt(flatItems, ['All Orders']).item, 'name').sort())
            .to.deep.equal(_.map(folderAt(nestedItems, ['All Orders']).item, 'name').sort());
          expect(tree(folderAt(flatItems, ['All Orders', '{id}']).item))
            .to.deep.equal(['GET /orders/:id', { items: ['GET /orders/:id/items'] }]);
          done();
        });
      });
    });
  });

  describe('folder name and description', function () {
    it('should use the displayName and description of a resource', function (done) {
      convert('/orders:\n  displayName: Orders API\n  description: All orders\n  get:\n' +
        '  /{id}:\n    displayName: Single order\n    get:\n', OPTION, (items) => {
        expect(tree(items)).to.deep.equal([{ 'Orders API': ['GET /orders', { 'Single order': ['GET /orders/:id'] }] }]);
        expect(items[0].description.content).to.equal('All orders');
        done();
      });
    });

    it('should name a folder after its segment when only a description is set', function (done) {
      convert('/orders:\n  description: All orders\n  get:\n', OPTION, (items) => {
        expect(tree(items)).to.deep.equal([{ orders: ['GET /orders'] }]);
        expect(items[0].description.content).to.equal('All orders');
        done();
      });
    });

    it('should name folders the same as collapse mode where collapse mode creates them', function (done) {
      var raml = '/orders:\n  get:\n  post:\n  /{id}:\n    displayName: Single order\n    get:\n    put:\n' +
        '/customers:\n  description: People\n  get:\n';

      convert(raml, {}, (defaultItems) => {
        convert(raml, OPTION, (items) => {
          expect(tree(items)).to.deep.equal(tree(defaultItems));
          done();
        });
      });
    });
  });

  describe('requests are the same as in default mode', function () {
    it('should apply a parent resource trait to child requests', function (done) {
      var raml = '/orders:\n  is: [ paged ]\n  get:\n  /{id}:\n    get:\n    /items:\n      get:\n';

      convert(raml, OPTION, (items) => {
        var requests = requestsByKey(items);

        _.forEach(['GET /orders', 'GET /orders/:id', 'GET /orders/:id/items'], (key) => {
          expect(_.map(requests[key].request.url.query, 'key'), key).to.include('page');
        });
        expectSameRequestsAsDefault(raml, done);
      });
    });

    it('should resolve uriParameters of a parent segment in child urls', function (done) {
      var raml = '/orders/{orderId}:\n  uriParameters:\n    orderId: { type: integer, example: 7 }\n  get:\n' +
        '  /items:\n    get:\n/a/{x}/b:\n  uriParameters:\n    x: { type: string, example: ex }\n  get:\n/a:\n  get:\n';

      convert(raml, OPTION, (items) => {
        var requests = requestsByKey(items);

        expect(tree(items)).to.deep.equal([
          { orders: [{ '{orderId}': ['GET /orders/:orderId', { items: ['GET /orders/:orderId/items'] }] }] },
          { a: ['GET /a', { '{x}': [{ b: ['GET /a/:x/b'] }] }] }
        ]);
        expect(_.find(requests['GET /orders/:orderId/items'].request.url.variable, { key: 'orderId' }).value)
          .to.equal('7');
        expect(_.find(requests['GET /a/:x/b'].request.url.variable, { key: 'x' }).value).to.equal('ex');
        expectSameRequestsAsDefault(raml, done);
      });
    });

    it('should place requests of a resourceType in the resource folder', function (done) {
      var raml = '/products:\n  type: collection\n/stock:\n  type: readOnly\n';

      convert(raml, OPTION, (items) => {
        expect(tree(items)).to.deep.equal([
          { products: ['GET /products', 'POST /products'] },
          { stock: ['GET /stock'] }
        ]);
        expect(folderAt(items, ['stock']).item[0].request.description).to.equal('Read stock');
        expectSameRequestsAsDefault(raml, done);
      });
    });

    _.forEach(FIXTURES, (file) => {
      it('should convert every request of ' + file + ' as in default mode', function (done) {
        var raml = fs.readFileSync(VALID_RAML_DIR_PATH + '/' + file).toString();

        convertRaml(raml, {}, (defaultResult) => {
          convertRaml(raml, OPTION, (result) => {
            expect(result.result).to.equal(defaultResult.result);
            defaultResult.result && expect(requestsByKey(result.output[0].data.item))
              .to.deep.equal(requestsByKey(defaultResult.output[0].data.item));
            done();
          });
        });
      });
    });
  });

  describe('option off', function () {
    _.forEach(FIXTURES, (file) => {
      it('should give the same output as the default options for ' + file, function (done) {
        var raml = fs.readFileSync(VALID_RAML_DIR_PATH + '/' + file).toString();

        convertRaml(raml, {}, (defaultResult) => {
          convertRaml(raml, { folderPerPathSegment: false }, (result) => {
            expect(withoutIds(result)).to.deep.equal(withoutIds(defaultResult));
            done();
          });
        });
      });
    });
  });
});
