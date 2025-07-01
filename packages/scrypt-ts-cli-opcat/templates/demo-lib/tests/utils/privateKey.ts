import {
    SupportedNetwork,
    fromSupportedNetwork,
} from '@opcat-labs/scrypt-ts-opcat'
import {PrivateKey} from '@opcat-labs/opcat'

import * as dotenv from 'dotenv'
import * as fs from 'fs'

export function genPrivKey(network: SupportedNetwork): PrivateKey {
    dotenv.config({
        path: '.env',
    })

    const privKeyStr = process.env.PRIVATE_KEY
    let keyPair: PrivateKey
    if (privKeyStr) {
        keyPair = PrivateKey.fromWIF(
            privKeyStr as string
        )
        console.log(`Private key already present ...`)
    } else {
        keyPair = PrivateKey.fromRandom(fromSupportedNetwork(network))
        console.log(`Private key generated and saved in "${'.env'}"`)
        console.log(`Publickey: ${keyPair.publicKey.toHex()}`)
        fs.writeFileSync('.env', `PRIVATE_KEY="${keyPair.toWIF()}"`)
    }

    const address = keyPair.toAddress(fromSupportedNetwork(network))
    const fundMessage = `You can fund its address '${address}' from the sCrypt faucet https://scrypt.io/faucet`

    console.log(fundMessage)

    return keyPair
}

export const myPrivateKey = genPrivKey('opcat-testnet')
