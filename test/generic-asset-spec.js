'use strict';

const asset = require('../asset/asset.json');

describe('A standard asset', () => {
    it('should have at least a name, version and description.', () => {
        expect(asset).toHaveProperty('name');
        expect(asset).toHaveProperty('version');
        expect(asset).toHaveProperty('description');
    });
});
