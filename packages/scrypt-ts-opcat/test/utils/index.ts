import { join } from 'path';
import { readFileSync } from 'fs';
import { getTestAddress, network } from './privateKey.js';
import { UTXO, SupportedNetwork } from '@opcat-labs/scrypt-ts-opcat';

import * as dotenv from 'dotenv';
import { Script } from '@opcat-labs/opcat';
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

export function getDummyUtxo(addr?: string , satoshis?: number): UTXO {

  if (!addr) {
    addr = getTestAddress();
  }
  return {
    txId: 'fa42b98cbd50338096f0dd3eecebb636f47ccaaa6fa7ebb50f3fee6567fa47d2',
    outputIndex: 0,
    script: Script.fromAddress(addr).toHex(),
    satoshis: satoshis || inputSatoshis,
    data: ''
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


export * from './helper.js'