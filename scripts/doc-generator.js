#!/usr/bin/env node

'use strict';

require('ts-node/register');

const {
    TestContext,
    toString,
    isString,
    getTypeOf,
    firstToUpper,
    opSchema,
    isFunction
} = require('@terascope/job-components');

const generateToc = require('markdown-toc');
const table = require('markdown-table');
const os = require('os');
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const assetPath = path.join(rootDir, 'asset');

if (!fs.existsSync(assetPath)) {
    throw new Error(`Assets does not exist at path ${assetPath}`);
}

const replaceThese = {
    $PWD: process.cwd(),
    $HOME: os.homedir(),
    $HOSTNAME: os.hostname(),
};

const docsPath = path.join(rootDir, './docs');
const repoName = path.basename(process.cwd());
const orgName = 'terascope';
const repo = `${orgName}/${repoName}`;

const context = new TestContext('operation-doc-generator');

function formatArr(arr) {
    return arr.map((v) => formatVal(v)).join(', ');
}

function formatVal(val, isType = false) {
    if (Array.isArray(val)) return formatArr(val);
    let str;

    if (isString(val)) {
        if (isType) {
            if (val.indexOf('required_') === 0) {
                str = `${val.replace('required_', '')}`;
            } else if (val.indexOf('optional_') === 0) {
                str = `${val.replace('optional_', '')}`;
            } else {
                str = `${val}`;
            }
        } else {
            str = `"${val}"`;
        }
    } else if (val && val.name) {
        str = val.name;
    } else {
        str = toString(val);
    }

    if (isString(str)) {
        for (const [replaceWith, searchFor] of Object.entries(replaceThese)) {
            str = str.replace(searchFor, replaceWith);
        }
    }

    return `\`${str}\``;
}

function formatDefaultVal(s) {
    const val = s.default;
    if (val == null || (isString(val) && !val)) return '-';
    return formatVal(val);
}

function formatType(s) {
    if (s.default != null && (!s.format || isFunction(s.format))) {
        const typeOf = getTypeOf(s.default);
        if (/^[`"']/.test(typeOf)) {
            return typeOf;
        }
        return `\`${typeOf}\``;
    }
    return firstToUpper(formatVal(s.format, true));
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
        .filter((p) => !!p)
        .filter((p) => p.trim())
        .join('\n\n');
}

function sanatizeStr(str) {
    if (!str) return '';
    return str.replace(/\r?\n|\r/g, '<br>').trim();
}

function generateConfigDocs(schemaPath, opType) {
    const SchemaModule = require(schemaPath);
    const Schema = SchemaModule.default || SchemaModule;

    if (Schema.type() !== 'convict') {
        throw new Error('Only convict Schema classes are allowed');
    }

    const data = [
        [
            'Field',
            'Type',
            'Default',
            'Description'
        ],
    ];

    const schema = Object.assign({}, opSchema, new Schema(context, opType).schema);

    function handleSchemaObj(schemaObj, prefix = '') {
        Object.keys(schemaObj)
            .sort()
            .forEach((field) => {
                const s = schemaObj[field];
                if (!s) return;

                const fullField = [prefix, field]
                    .join('.')
                    .replace(/^\./, '');

                if (!s.doc) {
                    handleSchemaObj(s, fullField);
                    return;
                }

                data.push([
                    `**${fullField}**`,
                    formatType(s),
                    formatDefaultVal(s),
                    sanatizeStr(s.doc),
                ]);
            });
    }

    handleSchemaObj(schema);

    return `**Configuration:**

${table(data, { align: 'c' })}`;
}

function createDocForOp({ opName, opPath }) {
    const schemaPath = resolvePath(opPath, 'schema');

    const parts = [
        `### ${formatName(opName)}`
    ];

    parts.push(readDoc(opName, 'OVERVIEW.md'));

    parts.push(`**Name:** \`${opName}\``);

    let opType = 'operation';
    if (isReader(opPath)) {
        parts.push('**Type:** `Reader`');
    } else if (isProcessor(opPath)) {
        parts.push('**Type:** `Processor`');
    } else if (isAPI(opPath)) {
        parts.push('**Type:** `API`');
        opType = 'api';
    }

    if (schemaPath != null) {
        parts.push(generateConfigDocs(schemaPath, opType));
    }

    parts.push(readDoc(opName, 'USAGE.md'));

    return formatMarkdown(parts);
}

function isReader(opPath) {
    return resolvePath(opPath, 'fetcher') != null;
}

function isAPI(opPath) {
    return resolvePath(opPath, 'api') != null;
}

function isProcessor(opPath) {
    return resolvePath(opPath, 'processor') != null;
}

function isOperation(opPath) {
    const hasSchema = resolvePath(path.join(opPath, 'schema')) != null;
    if (!hasSchema) return false;

    return hasSchema && (isReader(opPath) || isProcessor(opPath) || isAPI(opPath));
}

function readDoc(...parts) {
    const markdownPath = path.join(docsPath, ...parts);
    if (!fs.existsSync(markdownPath)) return '';

    return fs.readFileSync(markdownPath, 'utf8').trim();
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
        .filter((opName) => isOperation(path.join(searchPath, opName)))
        .map((opName) => ({
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

[![Build Status](https://travis-ci.org/${repo}.svg?branch=master)](https://travis-ci.org/${repo})
[![codecov](https://codecov.io/gh/${repo}/branch/master/graph/badge.svg)](https://codecov.io/gh/${repo})

${overview}
    `);

    parts.push('[INSERT-TOC]');

    parts.push(`## Releases

You can find a list of releases, changes, and pre-built asset bundles [here](https://github.com/${repo}/releases).`);


    parts.push(`## Getting Started

This asset bundle requires a running Teraslice cluster, you can find the documentation [here](https://github.com/terascope/teraslice/blob/master/README.md).

\`\`\`bash
# Step 1: make sure you have teraslice-cli installed
yarn global add teraslice-cli

# Step 2:
# FIXME: this should be accurate
teraslice-cli asset deploy ...
\`\`\``);

    const connectorsMd = readDoc('CONNECTORS.md');
    if (connectorsMd) {
        parts.push(`
**IMPORTANT:** Additionally make sure have installed the required [connectors](#connectors).

## Connectors
${connectorsMd}`);
    }

    return formatMarkdown(parts);
}

function addToc(body) {
    const toc = generateToc(body, { firsth1: false, bullets: '-' }).content;
    return body.replace('[INSERT-TOC]', toc);
}

function getFooter() {
    const parts = [];
    parts.push(readDoc('USAGE.md') || `
## Development

### Tests

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

const readme = addToc(formatMarkdown([
    getHeader(),
    getOperationDocs(),
    getFooter(),
]));

fs.writeFileSync(path.join(rootDir, 'README.md'), readme);
