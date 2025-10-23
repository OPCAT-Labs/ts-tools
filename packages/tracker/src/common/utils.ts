import { toTokenOwnerAddress } from '@opcat-labs/cat-sdk';
import { network } from './constants';
import { sha256 } from '@opcat-labs/scrypt-ts-opcat';

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
