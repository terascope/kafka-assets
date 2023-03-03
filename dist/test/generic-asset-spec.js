"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const assetJSONFile = path_1.default.join(__dirname, '..', 'asset', 'asset.json');
const asset = JSON.parse(fs_1.default.readFileSync(assetJSONFile, 'utf8'));
describe('A standard asset', () => {
    it('should have at least a name, version and description.', () => {
        expect(asset).toHaveProperty('name');
        expect(asset).toHaveProperty('version');
        expect(asset).toHaveProperty('description');
    });
});
//# sourceMappingURL=generic-asset-spec.js.map