import 'jest-extended';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const assetJSONFile = path.join(dirname, '..', 'asset', 'asset.json');
const asset = JSON.parse(fs.readFileSync(assetJSONFile, 'utf8'));

describe('A standard asset', () => {
    it('should have at least a name, version and description.', () => {
        expect(asset).toHaveProperty('name');
        expect(asset).toHaveProperty('version');
        expect(asset).toHaveProperty('description');
    });
});
