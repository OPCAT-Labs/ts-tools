import {
    SupportedNetwork,
    OpenApiProvider,
    DummyProvider,
    DefaultSigner,
    fromSupportedNetwork,
} from '@opcat-labs/scrypt-ts-opcat'
import { getTestKeyPair } from './privateKey'
import { PrivateKey } from '@opcat-labs/opcat'

export const sleep = async (seconds: number) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({})
        }, seconds * 1000)
    })
}

export function getDefaultProvider(network?: SupportedNetwork) {
    network = network ||
    network ||
    (process.env.NETWORK as SupportedNetwork) ||
    'opcat-testnet'

    if (process.env.DUMMY_PROVIDER) {
        return new DummyProvider(network)
    }

    return new OpenApiProvider(network)
}


export function getDefaultSigner() {
    const keyPair = getTestKeyPair();
    return new DefaultSigner(keyPair);
}

export function getRandomSigner(network?: SupportedNetwork) {
    network = network ||
    network ||
    (process.env.NETWORK as SupportedNetwork) ||
    'opcat-testnet'
    const key = PrivateKey.fromRandom(fromSupportedNetwork(network))
    return new DefaultSigner(key);
}



export function padLeadingZero(hex: string, byteslen: number = 0) {
  if(byteslen > 0) {
    if(hex.length < byteslen * 2) {
      return "0".repeat(byteslen * 2 - hex.length) + hex
    }
  }
  if(hex.length % 2 === 0) return hex;
  return "0" + hex;
}

export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min) + min) // The maximum is exclusive and the minimum is inclusive
}
