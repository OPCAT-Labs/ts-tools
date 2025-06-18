import * as dotenv from 'dotenv'
import { getDefaultProvider, getDefaultSigner } from './tests/utils/txHelper'
import { StatefulCovenant, deploy, call } from '@opcat-labs/scrypt-ts-opcat'
import { PROJECT_NAME } from 'package-name'

// Load the .env file
dotenv.config()

if (!process.env.PRIVATE_KEY) {
    throw new Error(
        'No "PRIVATE_KEY" found in .env, Please run "npm run genprivkey" to generate a private key'
    )
}

async function main() {
    const contract = new PROJECT_NAME()
    contract.state = {
        count: 0n,
    }

    let covenant = StatefulCovenant.createCovenant(contract)

    const provider = getDefaultProvider()
    const signer = getDefaultSigner()

    const deployPsbt = await deploy(signer, provider, covenant)

    const deployTx = deployPsbt.extractTransaction()

    console.log(`PROJECT_NAME contract deployed: ${deployTx.getId()}`)

    for (let i = 0; i < 10; i++) {
        const newCovenant = covenant.next({ count: covenant.state.count + 1n })

        const callPsbt = await call(
            signer,
            provider,
            covenant,
            {
                invokeMethod: (contract: PROJECT_NAME) => {
                    contract.increase()
                },
            },
            {
                covenant: newCovenant,
                satoshis: 330,
            }
        )

        const callTx = callPsbt.extractTransaction()

        console.log(`PROJECT_NAME contract called: ${callTx.getId()}`)
        covenant = newCovenant
    }
}

main()
