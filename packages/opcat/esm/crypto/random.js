'use strict';
import crypto from 'crypto';

function Random() { }

Random.getRandomBuffer = function (size) {
    return crypto.randomBytes(size);
};

export default Random;

export const {
    getRandomBuffer
} = Random;
