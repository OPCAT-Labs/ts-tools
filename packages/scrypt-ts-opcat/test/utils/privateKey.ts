import { Tap } from '@cmdcode/tapscript';
import {
  hexToUint8Array,
  DefaultSigner,
  SupportedNetwork,
  toBitcoinNetwork,
  uint8ArrayToHex,
} from '@opcat-labs/scrypt-ts-opcat';
import * as ecc from '@bitcoinerlab/secp256k1';
import ECPairFactory, { ECPairInterface } from 'ecpair';
const ECPair = ECPairFactory(ecc);
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { pathToFileURL } from 'url';

// apply .env file
dotenv.config();

export const network: SupportedNetwork = (process.env.NETWORK ||
  'fractal-testnet') as SupportedNetwork;
// validate network
if (network !== 'fractal-testnet' && network !== 'btc-signet' && network !== 'fractal-mainnet') {
  throw new Error(`Invalid network: ${network}`);
}

let _shouldLog = true; // only log once
export async function genKeyPair(network: SupportedNetwork): Promise<ECPairInterface> {
  const privKeyStr = process.env.PRIVATE_KEY;

  let keyPair: ECPairInterface;
  if (privKeyStr) {
    keyPair = ECPair.fromWIF(privKeyStr as string);
    _shouldLog && console.log(`Private key find, use PRIVATE_KEY in .env`);
  } else {
    keyPair = ECPair.makeRandom({
      network: toBitcoinNetwork(network),
    });
    _shouldLog && console.log(`Private key generated and saved in "${'.env'}"`);
    _shouldLog && console.log(`Publickey: ${uint8ArrayToHex(keyPair.publicKey)}`);
    fs.writeFileSync('.env', `PRIVATE_KEY="${keyPair.toWIF()}"`);
  }

  const address = await getP2TRAddress(keyPair, network);

  const fundMessage = `You can fund its address '${address}' from a ${network} faucet`;

  _shouldLog && console.log(fundMessage);
  _shouldLog = false;

  return keyPair;
}

export function getTweakedKeyPair(keyPair: ECPairInterface): ECPairInterface {
  const [tseckey] = Tap.getSecKey(keyPair.privateKey);
  const tweakedKeyPair = ECPair.fromPrivateKey(hexToUint8Array(tseckey), {
    network: toBitcoinNetwork(network),
  });
  return tweakedKeyPair;
}

export const testKeyPair = await genKeyPair(network);
export const testTweakedKeyPair = getTweakedKeyPair(testKeyPair);
export const testAddress = await getP2TRAddress(testKeyPair, network);
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // module was not imported but called directly
  genKeyPair(network as SupportedNetwork);
}

export async function getP2TRAddress(
  keyPair: ECPairInterface,
  network: SupportedNetwork,
): Promise<string> {
  const signer = new DefaultSigner(keyPair, network);
  return await signer.getAddress();
}

export async function getTestKeyPair() {
  return await genKeyPair(network as SupportedNetwork);
}

export async function getTestAddress() {
  const keyPair = await getTestKeyPair();
  return await getP2TRAddress(keyPair, network);
}
