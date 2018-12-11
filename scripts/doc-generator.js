#!/usr/bin/env node

'use strict';

require('ts-node/register');

const {
    TestContext,
    toString,
    isString,
    getTypeOf,
    firstToUpper
} = require('@terascope/job-components');

const generateToc = require('markdown-toc');
const table = require('markdown-table');
const fs = require('fs');
const path = require('path');

const assetPath = path.resolve('./asset');

if (!fs.existsSync(assetPath)) {
    throw new Error(`Assets does not exist at path ${assetPath}`);
}

const docsPath = path.resolve('./docs');
const assetName = path.basename(assetPath);

const context = new TestContext('operation-doc-generator');

function formatArr(arr) {
    return arr.map(v => `"${v}"`).join(', ');
}

function formatVal(val, wrapString = true) {
    if (Array.isArray(val)) return formatArr(val);
    if (val && val.name) return `${val.name}`;
    if (isString(val) && wrapString) return `"${val}"`;
    return toString(val);
}

function formatDefaultVal(s) {
    const val = s.default;
    if (val == null || (isString(val) && !val)) return 'none';
    return formatVal(val);
}

function formatType(s) {
    if (s.default && !s.format) return getTypeOf(s);
    return formatVal(s.format, false);
}

function formatName(name, suffix) {
    const sep = name.indexOf('-') > -1 ? '-' : '_';
    const friendlyName = name
        .split(sep)
        .map(firstToUpper)
        .filter((s) => {
            if (!suffix) return true;
            return s !== firstToUpper(suffix);
        })
        .join(' ');

    if (suffix) {
        return `${friendlyName} ${firstToUpper(suffix)}`;
    }

    return friendlyName;
}

function formatMarkdown(parts) {
    return parts
        .filter(p => !!p)
        .filter(p => p.trim())
        .join('\n\n');
}

function generateConfigDocs(schemaPath) {
    const SchemaModule = require(schemaPath);
    const Schema = SchemaModule.default || SchemaModule;

    const schema = new Schema(context);

    const data = [
        [
            'Field',
            'Type',
            'Default',
            'Description'
        ],
    ];


    for (const field of Object.keys(schema.schema)) {
        const s = schema.schema[field];

        data.push([
            field,
            formatType(s),
            formatDefaultVal(s),
            s.doc.trim(),
        ]);
    }

    return `**Configuration:**
${table(data)}`;
}

function createDocForOp({ opName, opPath }) {
    const schemaPath = resolvePath(opPath, 'schema');

    const parts = [
        `### ${formatName(opName)}`
    ];

    parts.push(readDoc(opName, 'OVERVIEW.md'));

    parts.push(`**Name:** \`${opName}\``);

    if (isReader(opPath)) {
        parts.push('**Type:** Reader');
    } else if (isProcessor(opPath)) {
        parts.push('**Type:** Processor');
    }

    if (schemaPath != null) {
        parts.push(generateConfigDocs(schemaPath));
    }

    parts.push(readDoc(opName, 'EXAMPLES.md'));

    return formatMarkdown(parts);
}

function isReader(opPath) {
    return resolvePath(opPath, 'fetcher') != null;
}

function isProcessor(opPath) {
    return resolvePath(opPath, 'processor') != null;
}

function isOperation(opPath) {
    const hasSchema = resolvePath(path.join(opPath, 'schema')) != null;
    if (!hasSchema) return false;

    return hasSchema && (isReader(opPath) || isProcessor(opPath));
}

function readDoc(...parts) {
    const markdownPath = path.join(docsPath, ...parts);
    if (!fs.existsSync(markdownPath)) return '';

    return fs.readFileSync(markdownPath, 'utf8');
}

function resolvePath(...parts) {
    const filePath = path.join(...parts);
    if (fs.existsSync(path)) return filePath;

    try {
        return require.resolve(filePath);
    } catch (err) {
        return null;
    }
}

function findOps(searchPath) {
    const srcPath = path.join(searchPath, 'src');
    if (fs.existsSync(srcPath)) return findOps(srcPath);

    return fs.readdirSync(searchPath)
        .filter(opName => isOperation(path.join(searchPath, opName)))
        .map(opName => ({
            opPath: path.join(searchPath, opName),
            opName,
        }));
}

function getOperationDocs() {
    const parts = findOps(assetPath).map(createDocForOp);

    parts.unshift('## Operations');

    return formatMarkdown(parts);
}

function getHeader() {
    const parts = [];

    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJSON = JSON.parse(fs.readFileSync(packagePath));

    const overview = readDoc('OVERVIEW.md') || `> ${packageJSON.description}`;
    parts.push(`# ${formatName(packageJSON.name, 'Bundle')}

[![Build Status](https://travis-ci.org/terascope/${assetName}.svg?branch=master)](https://travis-ci.org/terascope/${assetName})
[![codecov](https://codecov.io/gh/terascope/${assetName}/branch/master/graph/badge.svg)](https://codecov.io/gh/terascope/${assetName})

${overview}
    `);

    parts.push('This asset bundle requires a running Teraslice cluster, you can find the documentation [here](https://github.com/terascope/teraslice/blob/master/README.md).');

    parts.push('[INSERT-TOC]');

    parts.push(`## Installation

\`\`\`bash
# Step 1: make sure you have teraslice-cli installed
yarn global add teraslice-cli
# Step 2:
# FIXME: this should be accurate
teraslice-cli asset deploy ...
\`\`\``);

    parts.push(`## Releases

You can find a list of releases, changes, and pre-built asset bundles [here](https://github.com/terascope/kafka-assets/releases).`);

    return formatMarkdown(parts);
}

function addToc(body) {
    const toc = generateToc(body, { firsth1: false, bullets: '-' }).content;
    return body.replace('[INSERT-TOC]', toc);
}

function getFooter() {
    const parts = [];
    parts.push('## Development');

    parts.push(readDoc('DEVELOPMENT.md') || `### Tests

Run the tests for the asset bundle.

\`\`\`bash
yarn test
\`\`\`

### Build

Build a compiled asset bundle to deploy to a teraslice cluster.

\`\`\`bash
./scripts/build.sh
\`\`\``);

    parts.push(`## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.`);

    parts.push(`## License

[MIT](./LICENSE) licensed.`);

    return formatMarkdown(parts);
}

const readme = formatMarkdown([
    getHeader(),
    getOperationDocs(),
    getFooter(),
]);

process.stdout.write(addToc(readme));
