import {
  DefaultSigner,
  SupportedNetwork,
} from '@opcat-labs/scrypt-ts-opcat';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { pathToFileURL } from 'url';
import { PrivateKey } from '@opcat-labs/opcat';
import { fromSupportedNetwork } from '../../src/index.js';

// apply .env file
dotenv.config();

export const network: SupportedNetwork = (process.env.NETWORK ||
  'opcat-testnet') as SupportedNetwork;
// validate network
if (network !== 'opcat-testnet' && network !== 'opcat-regtest' && network !== 'opcat-mainnet') {
  throw new Error(`Invalid network: ${network}`);
}

let _shouldLog = true; // only log once
export function genKeyPair(network: SupportedNetwork): PrivateKey {
  const privKeyStr = process.env.PRIVATE_KEY;

  let keyPair: PrivateKey;
  if (privKeyStr) {
    keyPair = PrivateKey.fromWIF(privKeyStr as string);
    _shouldLog && console.log(`Private key find, use PRIVATE_KEY in .env`);
  } else {
    keyPair = PrivateKey.fromRandom(fromSupportedNetwork(network));
    _shouldLog && console.log(`Private key generated and saved in "${'.env'}"`);
    _shouldLog && console.log(`Publickey: ${keyPair.toPublicKey()}`);
    fs.writeFileSync('.env', `PRIVATE_KEY="${keyPair.toWIF()}"`);
  }

  const address = keyPair.toPublicKey().toAddress()

  const fundMessage = `You can fund its address '${address}' from a ${network} faucet`;

  _shouldLog && console.log(fundMessage);
  _shouldLog = false;

  return keyPair;
}


export const testKeyPair = genKeyPair(network);


if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // module was not imported but called directly
  genKeyPair(network as SupportedNetwork);
}


export function getTestKeyPair() {
  return genKeyPair(network as SupportedNetwork);
}

export function getTestAddress() {
  const keyPair = getTestKeyPair();
  return keyPair.toPublicKey().toAddress().toString();
}
