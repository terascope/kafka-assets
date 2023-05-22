#!/usr/bin/env node

const { exec } = require('')
const version = process.versions.node.split('.')[0];
console.log('version', version)

if (version)
