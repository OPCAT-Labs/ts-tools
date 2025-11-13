import { Opcode, Script } from "@opcat-labs/opcat";
import { ByteString, OpCode } from "../smart-contract/types/index.js";
import { byteStringToInt, intToByteString, toByteString } from "../smart-contract/fns/index.js";
import { encode as cborEncode, decode as cborDecode } from 'cbor2'
import { pushData, splitChunks } from "./common.js";
import {MAX_OP_PUSH_DATA_SIZE} from "./constants.js";


export type ContractHeader = {
  version: bigint;
  md5: ByteString;
  tags: string[];
}

/**
 * Fields allowed in header, like ordinals
 */
export const CONTRACT_HEADER_FIELD_FLAGS = {
  // 20 bytes md5 hash
  // serialize: 
  //   serialized = CONTRACT_HEADER_FIELDS.DM5 <hash>
  MD5: OpCode.OP_1,
  // arbitrary user defined tag
  // serialize: 
  //    tagParts = cbor.encode(tag)
  //    serialized = CONTRACT_HEADER_FIELDS.TAG + tagParts[0] + CONTRACT_HEADER_FIELDS.TAG + tagParts[1] + ....
  TAGS: OpCode.OP_2,
}
export type ContractHeaderField = keyof typeof CONTRACT_HEADER_FIELD_FLAGS;

export class ContractHeaderSerializer {

  // current version of contract header
  static readonly VERSION = 1n;
  static readonly SCRYPT_SYMBOL = '736372';
  private static readonly LIMIT = MAX_OP_PUSH_DATA_SIZE;
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
    bufs.push(Buffer.from(CONTRACT_HEADER_FIELD_FLAGS[field], 'hex'))
  }

  private static pushCbor(bufs: Buffer[], field: ContractHeaderField, value: any) {
    if (value === undefined || value === null) {
      return bufs
    }
    const data = Buffer.from(cborEncode(value))
    const dataChunks = splitChunks(Array.from(data), this.LIMIT)
    for (const chunk of dataChunks) {
      this.pushField(bufs, field)
      bufs.push(pushData(Buffer.from(chunk)));
    }
    return bufs;
  }

  private static pushShortField(bufs: Buffer[], field: ContractHeaderField, value: ByteString) {
    if (typeof value !== 'string') {
      throw new Error(`Invalid value type for field ${field}: ${typeof value}, expected string`)
    }
    this.pushField(bufs, field)
    bufs.push(pushData(Buffer.from(value, 'hex')))
  }

  static sealHeader(header: ContractHeader): string {
    let bufs: Buffer[] = []
    bufs.push(Buffer.from(this.ENVELOPE_HEAD_HEX, 'hex'))
    bufs.push(Buffer.from(intToByteString(header.version, 1n), 'hex'))
    this.pushShortField(bufs, 'MD5', header.md5);
    this.pushCbor(bufs, 'TAGS', header.tags);
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
    let tags: string = ''

    txOutScript = txOutScript.slice(this.ENVELOPE_HEAD_HEX.length)
    version = byteStringToInt(txOutScript.slice(0, 2))
    txOutScript = txOutScript.slice(2)

    const bodyAsm = Script.fromHex(txOutScript).toASM()
    const bodyAsmItems = bodyAsm.split(' ')
    let readIndex = 0;
    while (readIndex < bodyAsmItems.length) {
      const tagOP = Script.fromASM(bodyAsmItems[readIndex]).toHex().toLowerCase();
      if (tagOP == CONTRACT_HEADER_FIELD_FLAGS.MD5.toLowerCase()) {
        md5 = bodyAsmItems[readIndex + 1]
        readIndex += 2
      } else if (tagOP == CONTRACT_HEADER_FIELD_FLAGS.TAGS.toLowerCase()) {
        tags += bodyAsmItems[readIndex + 1]
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
      tags: tags.length > 0 ? cborDecode(Buffer.from(tags, 'hex')) : [],
    }
    return { header, lockingScript }
  }

}