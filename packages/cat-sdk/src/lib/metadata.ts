import { stringToHex } from '../utils'
import { CAT20Metadata, OpenMinterCAT20Meta } from '../contracts/cat20/types'
import { CAT721Metadata } from '../contracts/cat721/types'
import { Script } from '@opcat-labs/opcat'
import * as cbor from 'cbor2'
import { hexToUint8Array } from '@opcat-labs/scrypt-ts-opcat'

export interface CAT20TokenInfo<T extends CAT20Metadata> {
  tokenId: string
  /** token p2tr address */
  tokenScriptHash: string
  /** minter p2tr address */
  minterScriptHash: string
  /** genesis txid */
  genesisTxid: string
  /** deploy txid */
  deployTxid: string
  /** timestamp */
  timestamp: number
  /** metadata */
  metadata: T
}

export interface CAT721NftInfo<T extends CAT721Metadata> {
  metadata: T
  collectionId: string
  collectionScriptHash: string
  minterScriptHash: string
  genesisTxid: string
  deployTxid: string
}

function scaleUpAmounts(metadata: OpenMinterCAT20Meta): OpenMinterCAT20Meta {
  const clone = Object.assign({}, metadata)
  clone.max = scaleUpByDecimals(metadata.max, Number(metadata.decimals))
  clone.premine = scaleUpByDecimals(metadata.premine, Number(metadata.decimals))
  clone.limit = scaleUpByDecimals(metadata.limit, Number(metadata.decimals))
  return clone
}

function hexStrings<T extends CAT20Metadata>(metadata: T): T {
  return {
    ...metadata,
    name: stringToHex(metadata.name),
    symbol: stringToHex(metadata.symbol),
  }
}

function scaleUpByDecimals(amount: bigint, decimals: number) {
  return amount * BigInt(Math.pow(10, decimals))
}

export function formatMetadata<T extends CAT20Metadata>(
  metadata: T,
  scaleUpAmount: boolean = true
) {
  let clone: T = Object.assign({}, metadata)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (scaleUpAmount && typeof (metadata as any).max === 'bigint') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clone = scaleUpAmounts(metadata as any as OpenMinterCAT20Meta) as any as T
  }
  return hexStrings(clone)
}


export class MetadataSerializer {
  static readonly CAT_TAG = '03636174'; // OP_PUSH_3_bytes 'cat'
  static readonly LIMIT = 520;
  static readonly EnvelopeMarker = {
    Token: '51', // OP_1
    Collection: '52', // OP_2
    NFT: '53', // OP_3
  }
  static readonly ORDINAL_TAGS = {
    // https://en.bitcoin.it/wiki/Script
    // https://docs.ordinals.com/inscriptions.html
    CONTENT_TYPE: '51', // op_1
    CONTENT_BODY: '00', // OP_0
    POINTER: '53', // OP_3
    PARENT: '52', // OP_2
    METADATA: '55', // OP_5
    METAPROTOCOL: '57', // OP_7
    CONTENT_ENCODING: '59', // OP_9
    DELEGATE: '63', // OP_11
  }
  static readonly ORDINAL_TAGS_BYTES = {
    // https://docs.ordinals.com/inscriptions.html
    CONTENT_TYPE: '01',
    CONTENT_BODY: '01',
    POINTER: '03',
    PARENT: '02',
    METADATA: '05',
    METAPROTOCOL: '07',
    CONTENT_ENCODING: '09',
    DELEGATE: '0b',
  }

  private static pushOrdinalTag(res: Buffer[], tag: keyof typeof this.ORDINAL_TAGS) {
    res.push(Buffer.from(this.ORDINAL_TAGS[tag], 'hex'))
  }

  private static pushMetadata(res: Buffer[], metadata: Record<string, any>) {
    const m = new Map()
    for (const key in metadata) {
      m.set(key, metadata[key])
    }
    const data = Buffer.from(cbor.encode(m))
    const dataChunks = this.chunks(Array.from(data), this.LIMIT)

    // if the metadata exceeds the limit of 520, it is split into multiple chunks.
    for (const chunk of dataChunks) {
      this.pushOrdinalTag(res, 'METADATA')
      res.push(this.toPushData(Buffer.from(chunk)));
    }
    return res;
  }

  private static pushContent(
    res: Buffer[],
    content: {
      type: string,
      body: string
    }
  ) {
    this.pushOrdinalTag(res, 'CONTENT_TYPE')
    res.push(this.toPushData(Buffer.from(content.type, 'utf-8')))

    this.pushOrdinalTag(res, 'CONTENT_BODY')
    const dataChunks = this.chunks(Array.from(Buffer.from(content.body, 'hex')), this.LIMIT)
    // if the contentBody exceeds the limit of 520, it is split into multiple chunks.
    for (const chunk of dataChunks) {
      res.push(this.toPushData(Buffer.from(chunk)))
    }
    return res;
  }

  static serialize(
    type: keyof typeof this.EnvelopeMarker,
    info: {
      metadata: Record<string, any>,
      content?: {
        type: string
        body: string
      }
    }
  ) {
    const res = [];
    res.push(Buffer.from(this.CAT_TAG, 'hex')) // "cat"
    res.push(Buffer.from(this.EnvelopeMarker[type], 'hex')) // envelope marker
    
    switch(type) {
      case 'Token':
        this.pushMetadata(res, info.metadata)
        if (info.content) {
          throw new Error('Content is not supported for token')
        }
        break
      case 'Collection':
      case 'NFT':
        this.pushMetadata(res, info.metadata)
        if (info.content) {
          this.pushContent(res, info.content)
        }
        break
    }
    return Buffer.concat(res).toString('hex')
  }


  static deserialize(hex: string): {
    type: keyof typeof MetadataSerializer.EnvelopeMarker,
    info: {
      metadata: Record<string, any> | null,
      contentType: string
      contentBody: string
      pointer: string
      parent: string
      metaprotocol: string
      contentEncoding: string
      delegate: string
    }
  } | null {
    if (!hex.startsWith(MetadataSerializer.CAT_TAG)) return null
    
    const envelopeMarker = hex.slice(MetadataSerializer.CAT_TAG.length, MetadataSerializer.CAT_TAG.length + 2)

    if (
      envelopeMarker !== MetadataSerializer.EnvelopeMarker.Token &&
      envelopeMarker !== MetadataSerializer.EnvelopeMarker.Collection &&
      envelopeMarker !== MetadataSerializer.EnvelopeMarker.NFT
    ) {
      return null;
    }
    let type: keyof typeof MetadataSerializer.EnvelopeMarker = 'Token'
    if (envelopeMarker == MetadataSerializer.EnvelopeMarker.Token) {
      type = 'Token'
    } else if (envelopeMarker == MetadataSerializer.EnvelopeMarker.Collection) {
      type = 'Collection'
    } else if (envelopeMarker == MetadataSerializer.EnvelopeMarker.NFT) {
      type = 'NFT'
    }

    const body = hex.slice(MetadataSerializer.CAT_TAG.length + 2)
    const bodyAsm = Script.fromHex(body).toASM()

    let contentType = ''
    let contentBody = ''
    let pointer = ''
    let parent = ''
    let metadata = ''
    let metaprotocol = ''
    let contentEncoding = ''
    let delegate = ''


    const bodyAsmItems = bodyAsm.split(' ')
    let readIndex = 0;
    // if lastTagIsContentBody, the next bytes may be a part of contentBody
    let lastTagIsContentBody = false;
    while(readIndex < bodyAsmItems.length) {
      const tagOP = Script.fromASM(bodyAsmItems[readIndex]).toHex().toLowerCase();
      const tagBytes = bodyAsmItems[readIndex].toLowerCase()

      if (
        tagOP === MetadataSerializer.ORDINAL_TAGS.CONTENT_TYPE ||
        tagBytes === MetadataSerializer.ORDINAL_TAGS_BYTES.CONTENT_TYPE
      ) {
        contentType += bodyAsmItems[readIndex + 1]
        readIndex += 2
        lastTagIsContentBody = false
      } else if (
        tagOP === MetadataSerializer.ORDINAL_TAGS.CONTENT_BODY ||
        tagBytes === MetadataSerializer.ORDINAL_TAGS_BYTES.CONTENT_BODY
      ) {
        contentBody += bodyAsmItems[readIndex + 1]
        readIndex += 2
        lastTagIsContentBody = true
      } else if (
        tagOP === MetadataSerializer.ORDINAL_TAGS.POINTER ||
        tagBytes === MetadataSerializer.ORDINAL_TAGS_BYTES.POINTER
      ) {
        pointer += bodyAsmItems[readIndex + 1]
        readIndex += 2
        lastTagIsContentBody = false
      } else if (
        tagOP === MetadataSerializer.ORDINAL_TAGS.PARENT ||
        tagBytes === MetadataSerializer.ORDINAL_TAGS_BYTES.PARENT
      ) {
        parent += bodyAsmItems[readIndex + 1]
        readIndex += 2
        lastTagIsContentBody = false
      } else if (
        tagOP === MetadataSerializer.ORDINAL_TAGS.METADATA ||
        tagBytes === MetadataSerializer.ORDINAL_TAGS_BYTES.METADATA
      ) {
        metadata += bodyAsmItems[readIndex + 1]
        readIndex += 2
        lastTagIsContentBody = false
      } else if (
        tagOP === MetadataSerializer.ORDINAL_TAGS.METAPROTOCOL ||
        tagBytes === MetadataSerializer.ORDINAL_TAGS_BYTES.METAPROTOCOL
      ) {
        metaprotocol += bodyAsmItems[readIndex + 1]
        readIndex += 2
        lastTagIsContentBody = false
      } else if (
        tagOP === MetadataSerializer.ORDINAL_TAGS.CONTENT_ENCODING ||
        tagBytes === MetadataSerializer.ORDINAL_TAGS_BYTES.CONTENT_ENCODING
      ) {
        contentEncoding += bodyAsmItems[readIndex + 1]
        readIndex += 2
        lastTagIsContentBody = false
      } else if (
        tagOP === MetadataSerializer.ORDINAL_TAGS.DELEGATE ||
        tagBytes === MetadataSerializer.ORDINAL_TAGS_BYTES.DELEGATE
      ) {
        delegate += bodyAsmItems[readIndex + 1]
        readIndex += 2
        lastTagIsContentBody = false
      } else {
        if (lastTagIsContentBody) {
          contentBody += tagOP
          readIndex += 1
          lastTagIsContentBody = true
        } else {
          throw new Error(`Unknown tag: OPCODE: ${tagOP}, BYTES: ${tagBytes}, asmIndex: ${readIndex + 2}`)
        }
      }
    }
    
    return {
      type,
      info: {
        metadata: metadata ? cbor.decode(hexToUint8Array(metadata)) : null,
        contentType,
        contentBody,
        pointer,
        parent,
        metaprotocol,
        contentEncoding,
        delegate
      }
    }
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