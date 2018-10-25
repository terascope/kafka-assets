'use strict';

const asset = require('../asset/asset');
const pkg = require('../package.json');

describe('asset version', () => {
    it('should match package.json', () => {
        expect(asset.version).toEqual(pkg.version);
    });
});
