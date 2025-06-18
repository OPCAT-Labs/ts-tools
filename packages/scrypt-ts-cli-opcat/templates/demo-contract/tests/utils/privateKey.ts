import {
    SupportedNetwork,
    toBitcoinNetwork,
    uint8ArrayToHex,
} from '@opcat-labs/scrypt-ts-opcat'
import * as ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from '@opcat-labs/bitcoinjs-lib'
import ECPairFactory, { ECPairInterface } from '@opcat-labs/ecpair'
const ECPair = ECPairFactory(ecc)

import * as dotenv from 'dotenv'
import * as fs from 'fs'

export function genPrivKey(network: SupportedNetwork): ECPairInterface {
    dotenv.config({
        path: '.env',
    })

    const privKeyStr = process.env.PRIVATE_KEY
    let keyPair: ECPairInterface
    if (privKeyStr) {
        keyPair = ECPair.fromWIF(
            privKeyStr as string,
            toBitcoinNetwork(network)
        )
        console.log(`Private key already present ...`)
    } else {
        keyPair = ECPair.makeRandom({
            network: toBitcoinNetwork(network),
        })
        console.log(`Private key generated and saved in "${'.env'}"`)
        console.log(`Publickey: ${uint8ArrayToHex(keyPair.publicKey)}`)
        fs.writeFileSync('.env', `PRIVATE_KEY="${keyPair.toWIF()}"`)
    }

    const internalPubkey = keyPair.publicKey.subarray(1, 33)
    const { address } = bitcoinjs.payments.p2tr({
        internalPubkey: internalPubkey,
    })

    const fundMessage = `You can fund its address '${address}' from the sCrypt faucet https://scrypt.io/faucet`

    console.log(fundMessage)

    return keyPair
}

export const myPrivateKey = genPrivKey('fractal-testnet')
