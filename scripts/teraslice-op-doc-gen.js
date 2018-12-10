#!/usr/bin/env node

'use strict';

const {
    TestContext,
    toString,
    isString,
    getTypeOf
} = require('@terascope/job-components');
const table = require('markdown-table');
const fs = require('fs');
const path = require('path');

const [, scriptArg, opArg] = process.argv;

if (!opArg) {
    const scriptName = path.relative(process.cwd(), scriptArg);
    console.error(`
    Error: Missing <path/to/op> as first argument

    USAGE:
        node ${scriptName} <path/to/op>
    `);
}

const opPath = path.resolve(opArg);
if (!fs.existsSync(opPath)) {
    throw new Error(`Operation does not exist at path ${opPath}`);
}

const context = new TestContext('teraslice-doc-gen');

const SchemaModule = require(path.join(opPath, 'schema'));
const Schema = SchemaModule.default || SchemaModule;

const schema = new Schema(context);

const data = [
    ['Field', 'Type', 'Default', 'Description'],
];

function formatArr(arr) {
    return arr.map(v => `"${v}"`).join(', ');
}

function formatDefaultVal(s) {
    const val = s.default;
    if (val == null || (isString(val) && !val)) return 'none';
    if (Array.isArray(val)) return formatArr(val);
    return toString(val);
}

function formatType(s) {
    if (s.default && !s.format) return getTypeOf(s);
    if (Array.isArray(s.format)) return formatArr(s.format);
    if (s.format && s.format.name) return `${s.format.name}`;
    return toString(s.format);
}

for (const field of Object.keys(schema.schema)) {
    const s = schema.schema[field];

    data.push([
        field,
        formatType(s),
        formatDefaultVal(s),
        s.doc.trim(),
    ]);
}

process.stdout.write(table(data));
