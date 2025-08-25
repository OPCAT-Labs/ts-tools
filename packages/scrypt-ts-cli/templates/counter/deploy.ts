import * as dotenv from 'dotenv'
import { getDefaultProvider, getDefaultSigner } from './tests/utils/txHelper'
import { deploy, call } from '@opcat-labs/scrypt-ts'
import { PROJECT_NAME } from 'package-name'

// Load the .env file
dotenv.config()

if (!process.env.PRIVATE_KEY) {
    throw new Error(
        'No "PRIVATE_KEY" found in .env, Please run "npm run genprivkey" to generate a private key'
    )
}

async function main() {
    let contract = new PROJECT_NAME()
    contract.state = {
        count: 0n,
    }

    const provider = getDefaultProvider()
    const signer = getDefaultSigner()

    const deployPsbt = await deploy(signer, provider, contract, 1)

    const deployTx = deployPsbt.extractTransaction()

    console.log(`PROJECT_NAME contract deployed: ${deployTx.id}`)

    for (let i = 0; i < 10; i++) {
        const newContract = contract.next({ count: contract.state.count + 1n })

        const callPsbt = await call(
            signer,
            provider,
            contract,
            (contract: PROJECT_NAME) => {
                contract.increase()
            },
            
            {
                contract: newContract,
                satoshis: 1,
            }
        )

        const callTx = callPsbt.extractTransaction()

        console.log(`PROJECT_NAME contract called: ${callTx.id}`)
        contract = newContract
    }
}

main()
