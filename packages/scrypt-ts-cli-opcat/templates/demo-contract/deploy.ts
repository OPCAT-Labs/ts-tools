import * as dotenv from 'dotenv'
import { getDefaultProvider, getDefaultSigner } from './tests/utils/txHelper'
import {
    deploy,
    sha256,
    toByteString,
    call,
} from '@opcat-labs/scrypt-ts-opcat'
import { PROJECT_NAME } from 'package-name'

// Load the .env file
dotenv.config()

if (!process.env.PRIVATE_KEY) {
    throw new Error(
        'No "PRIVATE_KEY" found in .env, Please run "npm run genprivkey" to generate a private key'
    )
}

async function main() {
    let contract = new PROJECT_NAME(sha256(toByteString('hello world', true)))

    const provider = getDefaultProvider()
    const signer = getDefaultSigner()

    const deployPsbt = await deploy(signer, provider, contract, 1)

    const deployTx = deployPsbt.extractTransaction()

    console.log(`PROJECT_NAME contract deployed: ${deployTx.id}`)

    const callPsbt = await call(
        signer, 
        provider, 
        contract, 
        (contract: PROJECT_NAME) => {
            contract.unlock(toByteString('hello world', true))
        },
    )

    const callTx = callPsbt.extractTransaction()

    console.log(`PROJECT_NAME contract called: ${callTx.id}`)
}

main()
