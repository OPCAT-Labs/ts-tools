import * as dotenv from 'dotenv'
import * as fs from 'fs'
import { Network, Networks, PrivateKey } from '@opcat-labs/opcat'

export function genPrivKey(network: Network): PrivateKey {
  dotenv.config({
    path: '.env',
  })

  const privKeyStr = process.env.PRIVATE_KEY
  let privKey: PrivateKey
  if (privKeyStr) {
    privKey = PrivateKey.fromWIF(privKeyStr as string)
    console.log(`Private key already present ...`)
    console.log(`Address: ${privKey.toAddress(network)}`)
  } else {
    privKey = PrivateKey.fromRandom(network)
    console.log(`Private key generated and saved in "${'.env'}"`)
    console.log(`Publickey: ${privKey.publicKey}`)
    console.log(`Address: ${privKey.toAddress(network)}`)
    fs.writeFileSync('.env', `PRIVATE_KEY="${privKey}"`)
  }
  return privKey
}

export const myPrivateKey = genPrivKey(Networks.testnet)
