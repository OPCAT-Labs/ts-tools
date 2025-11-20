import { toTokenOwnerAddress } from '@opcat-labs/cat-sdk';
import { network } from './constants';
import { sha256 } from '@opcat-labs/scrypt-ts-opcat';
import { util as opcatUtil} from '@opcat-labs/opcat'

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function okResponse(data: any) {
  return {
    code: 0,
    msg: 'OK',
    data,
  };
}

export function errorResponse(e: Error) {
  return {
    code: 400,
    msg: e.message,
    data: null,
  };
}

export function ownerAddressToPubKeyHash(ownerAddr: string) {
  return toTokenOwnerAddress(ownerAddr)
}

export const stringify = (data) => {
  return JSON.stringify(data, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
};


/**
 * Convert binary to integer according to the sign-magnitude rule in little-endian.
 * Note that an empty binary is treated as 0 to align with bitcoin.
 */
export function bin2num(bin: Buffer): number {
  if (bin.length === 0) {
    return 0;
  }
  const msbIndex = bin.length - 1;
  const sign = (bin[msbIndex] & 0x80) !== 0 ? -1 : 1;
  const magnitude = Buffer.from(bin);
  magnitude[msbIndex] = magnitude[msbIndex] & 0x7f; // clear sign bit
  const value = magnitude.readUIntLE(0, magnitude.length);
  return sign * value;
}



export function parseBlockchainIdentifier(
  str: string
): {
  isSha256Hash: boolean;
  isOutpoint: boolean;
  outpoint?: { txid: string; index: number}
} {
  let ret: {
    isSha256Hash: boolean;
    isOutpoint: boolean;
    outpoint?: { txid: string; index: number}
  } = {
    isSha256Hash: false,
    isOutpoint: false
  };

  // detect sha256 hash
  if (opcatUtil.js.isHexa(str)) {
    if (str.length === 64) {
      ret.isSha256Hash = true;
    }
  }

  // detect outpoint
  const parts = str.split('_');
  if (parts.length === 2) {
    const txid = parts[0];
    const indexStr = parts[1];
    if (opcatUtil.js.isHexa(txid) && txid.length === 64) {
      const index = Number(indexStr);
      if (Number.isInteger(index) && index >= 0) {
        ret.isOutpoint = true;
        ret.outpoint = { txid, index };
      }
    }
  }

  return ret;
}
