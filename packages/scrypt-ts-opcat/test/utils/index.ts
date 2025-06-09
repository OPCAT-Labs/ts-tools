import { join } from 'path';
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { getTestAddress, network } from './privateKey.js';
import { address } from '@scrypt-inc/bitcoinjs-lib';
import { uint8ArrayToHex, UTXO, SupportedNetwork, toBitcoinNetwork } from '../../src/index.js';
import { emptyStateHashes } from '../../src/utils/common.js';

import * as dotenv from 'dotenv';
import { ExtUtxo } from '../../src/covenant.js';
dotenv.config({
  path: '.env',
});

export const feeRate = 10;
export const inputSatoshis = 1_000_000;
export const NETWORK: SupportedNetwork = network;

export function readArtifact(artifactFileName: string) {
  const filePath = join(process.cwd(), 'test', 'fixtures', artifactFileName);
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export async function getDummyUtxo(addr?: string, satoshis?: number): Promise<UTXO> {
  addr ||= await getTestAddress();
  return {
    txId: randomBytes(32).toString('hex'),
    outputIndex: 0,
    script: uint8ArrayToHex(address.toOutputScript(addr, toBitcoinNetwork(NETWORK))),
    satoshis: satoshis || inputSatoshis,
  };
}

export async function getDummyExtUtxo(addr?: string, satoshis?: number): Promise<ExtUtxo> {
  return {
    ...(await getDummyUtxo(addr, satoshis)),
    txHashPreimage:
      '02000000019ffd5845b0424732af076e67b28a05354bddda631e87784b0d65f52675cc60c10000000000ffffffff0300000000000000001a6a18636174013e8cd53bfc578703365087c18c60f8a7f08d5958e803000000000000225120f6d19fba042c55172f89cab22944e6efc4f780ba17f15392bf3717eb1bf908759a3d0f0000000000225120fac1f72fc3e3fb2d3098249d9eaab3fdadf5b2d6f7dd695373cd273176cc9e9000000000',
    txoStateHashes: emptyStateHashes(),
  };
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createLogger(prefix: string) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info: (...args: any[]) => {
      let logPrefix = `%c[${prefix}]`;
      let leftArgs = args;
      if (typeof args[0] === 'string' && args.length > 1) {
        logPrefix += ` ${args[0]}`;
        leftArgs = args.slice(1);
      }
      const style = 'color: #ecf6fd; font-weight: bold;';
      console.log(logPrefix, style, ...leftArgs);
    },
  };
}
