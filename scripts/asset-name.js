'use strict';

const asset = require('../asset/asset');

console.log(`${asset.name}-v${asset.version}-node-${process.version.split('.')[0].substr(1)}-${process.platform}-${process.arch}.zip`);
