import {
    SupportedNetwork,
    MempoolProvider,
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

    return new MempoolProvider(network)
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


