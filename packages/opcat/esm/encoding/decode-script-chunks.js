/**
 * Decodes script chunks from a buffer according to Bitcoin script encoding rules.
 * Processes opcodes and associated data pushes, handling different data length encodings.
 * 
 * @param {Buffer} script - The buffer containing encoded script data to decode
 * @returns {Array.<{opcodenum:number, len:number, buf?: Buffer}>} chunks - An array of decoded chunks, each containing opcode information and optionally buffer data
 */
function decodeScriptChunks(script) {
  const chunks = [];
  let i = 0;
  let len = 0;
  while (i < script.length) {
    const opcodenum = script[i];
    i += 1;
    
    // Handle different opcode types based on their values
    if (opcodenum === 0) {
      // Handle OP_0 (empty push)
      len = opcodenum;
      chunks.push({ opcodenum: opcodenum, len });
    } else if (opcodenum < 76) {
      // Handle data pushes with length < 76 (OP_PUSHDATA1)
      len = opcodenum;
      chunks.push({ opcodenum: opcodenum, buf: script.slice(i, i + opcodenum), len });
      i += opcodenum;
    } else if (opcodenum === 76) {
      // OP_PUSHDATA1 - Handle data pushes with 1-byte length specifier
      len = script[i];
      i += 1;
      chunks.push({ opcodenum: opcodenum, buf: script.slice(i, i + len), len });
      i += len;
    } else if (opcodenum === 77) {
      // OP_PUSHDATA2 - Handle data pushes with 2-byte length specifier
      len = script[i] | (script[i + 1] << 8);
      i += 2;
      chunks.push({ opcodenum: opcodenum, buf: script.slice(i, i + len), len });
      i += len;
    } else if (opcodenum === 78) {
      // OP_PUSHDATA4 - Handle data pushes with 4-byte length specifier
      len =
        script[i] + script[i + 1] * 0x0100 + script[i + 2] * 0x010000 + script[i + 3] * 0x01000000;
      i += 4;
      chunks.push({ opcodenum: opcodenum, buf: script.slice(i, i + len), len });
      i += len;
    } else {
      // Handle other opcodes without data pushes
      chunks.push({ opcodenum: opcodenum });
    }
  }
  // if (i !== script.length) throw new Error('bad script')
  return chunks;
}

export default decodeScriptChunks;
