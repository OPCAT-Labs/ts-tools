import {
    DefaultSigner,
    SupportedNetwork,
    MempoolProvider,
    DummyProvider,
} from '@opcat-labs/scrypt-ts-opcat'
import { genPrivKey } from './privateKey'

export function getDefaultSigner(): DefaultSigner {
    const network: SupportedNetwork =
        (process.env.NETWORK as SupportedNetwork) || 'fractal-testnet'

    const key = genPrivKey(network)

    const wallet = new DefaultSigner(key)

    return wallet
}

export const sleep = async (seconds: number) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({})
        }, seconds * 1000)
    })
}

export function getDefaultProvider(network?: SupportedNetwork) {
    if (process.env.DUMMY_PROVIDER) {
        return new DummyProvider()
    }
    const _network: SupportedNetwork =
        network ||
        (process.env.NETWORK as SupportedNetwork) ||
        'fractal-testnet'
    return new MempoolProvider(_network)
}
