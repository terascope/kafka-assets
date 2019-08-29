import 'jest-extended';
import fs from 'fs';
import path from 'path';

const assetJSONFile = path.join(__dirname, '..', 'asset', 'asset.json');
const asset = JSON.parse(fs.readFileSync(assetJSONFile, 'utf8'));

describe('A standard asset', () => {
    it('should have at least a name, version and description.', () => {
        expect(asset).toHaveProperty('name');
        expect(asset).toHaveProperty('version');
        expect(asset).toHaveProperty('description');
    });
});
