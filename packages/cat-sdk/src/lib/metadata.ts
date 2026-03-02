import { CAT20Metadata, OpenMinterCAT20Meta } from '../contracts/cat20/types.js'
import { CAT721Metadata } from '../contracts/cat721/types.js'
import { Script, util as opcatUtil } from '@opcat-labs/opcat'
import {encode as cborEncode, decode as cborDecode} from 'cbor2'
import { hexToUint8Array , pushData, splitChunks, MAX_OP_PUSH_DATA_SIZE} from '@opcat-labs/scrypt-ts-opcat'

/**
 * The information of a CAT20 token
 * @category Metadata
 * @category CAT20
 */
export interface CAT20TokenInfo<T extends CAT20Metadata> {
  tokenId: string
  /** token lockingScript hash */
  tokenScriptHash: string
  /** whether the token has admin privileges */
  hasAdmin: boolean
  /** admin lockingScript hash */
  adminScriptHash: string
  /** admin genesis outpoint (different from tokenId when hasAdmin is true) */
  adminGenesisOutpoint?: string
  /** minter lockingScript hash */
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

/**
 * The information of a CAT721 Collection
 * @category Metadata
 * @category CAT721
 */
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

function scaleUpByDecimals(amount: bigint, decimals: number) {
  return amount * BigInt(Math.pow(10, decimals))
}

/**
 * Format the metadata, scale up the amounts if scaleUpAmount is true, and convert the symbol and name from utf8 strings to hex strings
 * @category Metadata
 */
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
  return clone
}

export const ImageMimeTypes: string[] = [
  'image/apng',        // Animated Portable Network Graphics (APNG)
  'image/avif',        // AV1 Image File Format (AVIF)
  'image/bmp',         // Bitmap image (BMP)
  'image/gif',         // Graphics Interchange Format (GIF)
  'image/jpeg',        // Joint Photographic Expert Group image (JPEG)
  'image/png',         // Portable Network Graphics (PNG)
  'image/svg+xml',     // Scalable Vector Graphics (SVG)
  'image/tiff',        // Tagged Image File Format (TIFF)
  'image/webp',        // Web Picture format (WEBP)
  'image/vnd.microsoft.icon' // Icon format (ICO)
]

/**
 * Metadata serializer for CAT20 and CAT721, serialize the metadata and content or ordinals like format, deserialize the metadata and content from ordinals like format
 * @category Metadata
 * @category CAT20
 * @category CAT721
 */
export class MetadataSerializer {
  static readonly CAT_TAG = '03636174'; // OP_PUSH_3_bytes 'cat'
  static readonly LIMIT = MAX_OP_PUSH_DATA_SIZE;
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
    const data = Buffer.from(cborEncode(m))
    const dataChunks = splitChunks(Array.from(data), this.LIMIT)

    // if the metadata exceeds the limit of MetadataSerializer.LIMIT, it is split into multiple chunks.
    for (const chunk of dataChunks) {
      this.pushOrdinalTag(res, 'METADATA')
      res.push(pushData(Buffer.from(chunk)));
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
    res.push(pushData(Buffer.from(content.type, 'utf-8')))

    this.pushOrdinalTag(res, 'CONTENT_BODY')
    const dataChunks = splitChunks(Array.from(Buffer.from(content.body, 'hex')), this.LIMIT)
    if (dataChunks.length === 0) {
      throw new Error('Content body is empty or its not a hex string')
    }
    // if the contentBody exceeds the limit of MetadataSerializer.LIMIT, it is split into multiple chunks.
    for (const chunk of dataChunks) {
      res.push(pushData(Buffer.from(chunk)))
    }
    return res;
  }

  /**
   * serialize the CAT20 or CAT721 metadata and content
   * @param type 
   * @param info 
   * @returns 
   */
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

    switch (type) {
      case 'Token':
        this.pushMetadata(res, info.metadata)
        if (info.content) {
          throw new Error('Token metadata should not contain content')
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

  /**
   * decode the contentType from hex to utf8 string
   * @param contentType
   * @returns
   */
  static decodeContentType(contentType: string) {
    if (!contentType) {
      return ''
    }
    if (opcatUtil.js.isHexa(contentType)) {
      try {
        // if the contentType is hex, return the original contentType
        return Buffer.from(contentType, 'hex').toString('utf-8')
      } catch (e) {
        return contentType
      }
    }
    return contentType
  }


  /**
   * deserialize the metadata and content from ordinals like format
   * @param hex 
   * @returns 
   */
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
    while (readIndex < bodyAsmItems.length) {
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
        metadata: metadata ? cborDecode(hexToUint8Array(metadata)) : null,
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