import { Opcode, Script } from "@opcat-labs/opcat";
import { ByteString, OpCode } from "../smart-contract/types/index.js";
import { byteStringToInt, intToByteString, toByteString } from "../smart-contract/fns/index.js";
import {encode as cborEncode, decode as cborDecode} from 'cbor2'


export type ContractHeader = {
  version: bigint;
  md5: ByteString;
  tag: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Fields allowed in header, like ordinals
 */
export const CONTRACT_HEADER_FIELDS = {
  // 20 bytes md5 hash
  // serialize: 
  //   serialized = CONTRACT_HEADER_FIELDS.DM5 OP_PUSH_20_bytes <hash>
  MD5: OpCode.OP_1,
  // arbitrary user defined tag
  // serialize: 
  //    tagParts = cbor.encode(tag)
  //    serialized = CONTRACT_HEADER_FIELDS.TAG + tagParts[0] + CONTRACT_HEADER_FIELDS.TAG + tagParts[1] + ....
  TAG: OpCode.OP_2,
}
export type ContractHeaderField = keyof typeof CONTRACT_HEADER_FIELDS;

export class ContractHeaderSerializer {

  // current version of contract header
  static readonly VERSION = 1n;
  static readonly SCRYPT_SYMBOL = '736372';
  private static readonly LIMIT = 520;
  private static readonly ENVELOPE = {
    head: [
      OpCode.OP_FALSE,
      OpCode.OP_IF,
      '04',   // op_push_4_bytes: symbol('scr' 3 bytes) + version(1 byte)
      toByteString(this.SCRYPT_SYMBOL),
    ],
    tail: [
      OpCode.OP_ENDIF,
    ]
  }
  static get ENVELOPE_HEAD_HEX() {
    return this.ENVELOPE.head.join('')
  }
  static get ENVELOPE_TAIL_HEX() {
    return this.ENVELOPE.tail.join('')
  }

  /**
   * serialize the header, and concat the serialized header with the lockingScript without header
   * @param {ContractHeader} header the contract header
   * @param {string} contractLockingScript the lockingScript without header
   * @returns the script that used by transaction output
   */
  static serialize(header: ContractHeader, contractLockingScript: ByteString): ByteString {
    const headerHex = this.sealHeader(header)
    return headerHex + contractLockingScript
  }
  /**
   * deserialize the header and lockingScript from the transaction output script
   * @param txOutScript the transaction output script
   * @returns the header and the contractLockingScript
   */
  static deserialize(txOutScript: ByteString): { header: ContractHeader | null, lockingScript: string } {
    return this.unsealHeader(txOutScript);
  }

  private static pushField(bufs: Buffer[], field: ContractHeaderField) {
    bufs.push(Buffer.from(CONTRACT_HEADER_FIELDS[field], 'hex'))
  }

  private static pushCbor(bufs: Buffer[], field: ContractHeaderField, value: any) {
    if (value === undefined || value === null) {
      return bufs
    }
    const data = Buffer.from(cborEncode(value))
    const dataChunks = this.chunks(Array.from(data), this.LIMIT)
    for (const chunk of dataChunks) {
      this.pushField(bufs, field)
      bufs.push(this.toPushData(Buffer.from(chunk)));
    }
    return bufs;
  }

  private static pushShortField(bufs: Buffer[], field: ContractHeaderField, value: ByteString) {
    if (typeof value !== 'string') {
      throw new Error(`Invalid value type for field ${field}: ${typeof value}, expected string`)
    }
    this.pushField(bufs, field)
    bufs.push(this.toPushData(Buffer.from(value, 'hex')))
  }

  private static toPushData(data: Buffer): Buffer {
    const res: Array<Buffer> = [];

    const dLen = data.length;
    if (dLen < 0x4c) {
      const dLenBuff = Buffer.alloc(1);
      dLenBuff.writeUInt8(dLen);
      res.push(dLenBuff);
    } else if (dLen <= 0xff) {
      // OP_PUSHDATA1
      res.push(Buffer.from('4c', 'hex'));

      const dLenBuff = Buffer.alloc(1);
      dLenBuff.writeUInt8(dLen);
      res.push(dLenBuff);
    } else if (dLen <= 0xffff) {
      // OP_PUSHDATA2
      res.push(Buffer.from('4d', 'hex'));

      const dLenBuff = Buffer.alloc(2);
      dLenBuff.writeUint16LE(dLen);
      res.push(dLenBuff);
    } else {
      // OP_PUSHDATA4
      res.push(Buffer.from('4e', 'hex'));

      const dLenBuff = Buffer.alloc(4);
      dLenBuff.writeUint32LE(dLen);
      res.push(dLenBuff);
    }

    res.push(data);
    return Buffer.concat(res);
  }

  static sealHeader(header: ContractHeader): string {
    let bufs: Buffer[] = []
    bufs.push(Buffer.from(this.ENVELOPE_HEAD_HEX, 'hex'))
    bufs.push(Buffer.from(intToByteString(header.version, 1n), 'hex'))
    this.pushShortField(bufs, 'MD5', header.md5);
    this.pushCbor(bufs, 'TAG', header.tag);
    bufs.push(Buffer.from(this.ENVELOPE_TAIL_HEX, 'hex'))
    return Buffer.concat(bufs).toString('hex')
  }
  static unsealHeader(txOutScript: ByteString): {
    header: ContractHeader | null,
    lockingScript: string,
  } {
    if (!txOutScript.startsWith(this.ENVELOPE_HEAD_HEX)) {
      return {
        header: null,
        lockingScript: txOutScript,
      }
    }

    let version: bigint
    let md5: string = ''
    let tag: string = ''

    txOutScript = txOutScript.slice(this.ENVELOPE_HEAD_HEX.length)
    version = byteStringToInt(txOutScript.slice(0, 2))
    txOutScript = txOutScript.slice(2)

    const bodyAsm = Script.fromHex(txOutScript).toASM()
    const bodyAsmItems = bodyAsm.split(' ')
    let readIndex = 0;
    while (readIndex < bodyAsmItems.length) {
      const tagOP = Script.fromASM(bodyAsmItems[readIndex]).toHex().toLowerCase();
      if (tagOP == CONTRACT_HEADER_FIELDS.MD5.toLowerCase()) {
        md5 = bodyAsmItems[readIndex + 1]
        readIndex += 2
      } else if (tagOP == CONTRACT_HEADER_FIELDS.TAG.toLowerCase()) {
        tag += bodyAsmItems[readIndex + 1]
        readIndex += 2
      } else if (tagOP == OpCode.OP_ENDIF.toLowerCase()) {
        readIndex += 1;
        break;
      } else {
        throw new Error(`Invalid contract header OP: ${tagOP}`)
      }
    }

    const lockingScript = Script.fromASM(bodyAsmItems.slice(readIndex).join(' ')).toHex()

    let header: ContractHeader = {
      version,
      md5,
      tag: tag.length > 0 ? cborDecode(Buffer.from(tag, 'hex')) : null,
    }
    return { header, lockingScript }

  }


  private static chunks<T>(bin: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    let offset = 0;

    while (offset < bin.length) {
      // Use Buffer.slice to create a chunk. This method does not copy the memory;
      // it creates a new Buffer that references the original memory.
      const chunk = bin.slice(offset, offset + chunkSize);
      chunks.push(chunk);
      offset += chunkSize;
    }

    return chunks;
  }
}