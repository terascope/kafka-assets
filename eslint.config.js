import eslintConfig from '@terascope/eslint-config';
// need to probably put this in original eslint-config
// don't lint the dist folder
eslintConfig[0].ignores.push('dist/', '**/dist/**');

export default eslintConfig;
