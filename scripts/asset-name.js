'use strict';

const asset = require('../asset/asset');

const nodeVersion = process.version.split('.')[0].substr(1);
console.log(`${asset.name}-v${asset.version}-node-${nodeVersion}-${process.platform}-${process.arch}.zip`);
