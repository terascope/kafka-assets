'use strict';

const asset = require('../asset/asset');

console.log(`${asset.name}-v${asset.version}-node-${process.version}-${process.platform}-${process.arch}.zip`);
