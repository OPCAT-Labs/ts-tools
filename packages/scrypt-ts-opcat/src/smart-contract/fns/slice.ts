import { ByteString, Int32 } from '../types/index.js';

/**
 * Returns a section of a ByteString.
 * @param byteString The ByteString.
 * @param start The beginning byte index of the specified portion of ByteString, included.
 * @param end The end byte index of the specified portion of ByteString, excluded.
 *  If this value is not specified, the sub-section continues to the end of ByteString.
 */
export function slice(byteString: ByteString, start: Int32, end?: Int32): ByteString {
    const startIndex = Number(start) * 2
    const endIndex = typeof end === 'bigint' ? Number(end) * 2 : byteString.length;
    if (startIndex < 0 || endIndex < 0) {
        throw new Error('index should not be negative')
    }
    if (typeof end === 'bigint' && startIndex > endIndex) {
        throw new Error('start index should be less than or equal to end index')
    }

    if (startIndex > byteString.length) {
        throw new Error('start index should not be greater than the length')
    }

    if (endIndex > byteString.length) {
        throw new Error('end index should not be greater than the length')
    }

    return byteString.slice(startIndex, endIndex)
}