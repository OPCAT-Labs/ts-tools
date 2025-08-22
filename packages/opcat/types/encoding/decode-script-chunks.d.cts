export = decodeScriptChunks;
/**
 * Decodes script chunks from a buffer according to Bitcoin script encoding rules.
 * Processes opcodes and associated data pushes, handling different data length encodings.
 *
 * @param {Buffer} script - The buffer containing encoded script data to decode
 * @returns {Array.<{opcodenum:number, len:number, buf?: Buffer}>} chunks - An array of decoded chunks, each containing opcode information and optionally buffer data
 */
declare function decodeScriptChunks(script: Buffer): {
    opcodenum: number;
    len: number;
    buf?: Buffer;
}[];
