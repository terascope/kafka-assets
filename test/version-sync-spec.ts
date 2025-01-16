import path from 'node:path';
import fse from 'fs-extra';
import semver from 'semver';

describe('Ensure asset.json, package.json and root package.json versions are in sync', () => {
    it('Versions are equal', () => {
        const pathToAssetPkgJson = path.join(process.cwd(), './asset/package.json');
        const assetPkgJsonVersion = fse.readJSONSync(pathToAssetPkgJson).version;
        const pathToAssetJson = path.join(process.cwd(), './asset/asset.json');
        const assetVersion = fse.readJSONSync(pathToAssetJson).version;
        const pathToRootPkgJson = path.join(process.cwd(), './package.json');
        const rootVersion = fse.readJSONSync(pathToRootPkgJson).version;

        expect(semver.eq(assetPkgJsonVersion, rootVersion)).toBe(true);
        expect(semver.eq(assetVersion, rootVersion)).toBe(true);
    });
});
