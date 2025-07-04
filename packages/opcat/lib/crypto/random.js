'use strict';
var crypto = require('crypto');

function Random() { }

Random.getRandomBuffer = function (size) {
    return crypto.randomBytes(size);
};

module.exports = Random;
