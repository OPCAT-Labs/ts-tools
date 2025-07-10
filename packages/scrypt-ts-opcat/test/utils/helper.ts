import {
    SupportedNetwork,
    MempoolProvider,
    DummyProvider,
    DefaultSigner,
    fromSupportedNetwork,
    PrivateKey,
} from '@opcat-labs/scrypt-ts-opcat'
import { getTestKeyPair } from './privateKey'

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

    const provider = new MempoolProvider(network)
    const originalGetUtxos = provider.getUtxos.bind(provider)
    provider.getUtxos = async (address: string) => {
        await sleep(2) // wait for 2 seconds, so that the utxos are ready
        const utxos = await originalGetUtxos(address)
        return utxos.slice(0, 10)
    }
    return provider
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


