import { RPCProvider, DummyProvider, ChainProvider, UtxoProvider, SupportedNetwork, MempoolProvider } from '@opcat-labs/scrypt-ts-opcat'
import * as dotenv from 'dotenv'
dotenv.config({
  path: '.env',
})

function createTestProvider(): ChainProvider & UtxoProvider {
  const network = process.env.NETWORK as SupportedNetwork
  if (!network) {
    const provider = new DummyProvider('opcat-testnet')
    const originalGetUtxos = provider.getUtxos.bind(provider)
    provider.getUtxos = async (...args) => {
      const utxos = await originalGetUtxos(...args)
      return utxos.map(utxo => ({...utxo, txId: '5ba9527a949f223da586d2d2b4d49be54b61523ef1490c256ae69ee74a632877'}))
    }
    return provider
  }
  const provider = new MempoolProvider(
    'opcat-testnet'
  )

  const getUtxosFn = provider.getUtxos.bind(provider)
  provider.getUtxos = async (...args) => {
    // wait for 1 second to make sure the node is synced
    await new Promise((resolve) => setTimeout(resolve, 3000))
    const utxos = await getUtxosFn(...args)
    return utxos
  }
  // const getFeeRateFn = provider.getFeeRate.bind(provider)
  provider.getFeeRate = async () => {
    // const feeRate = await getFeeRateFn()
    // console.log('feeRate: ', feeRate)
    return 2;
    // return feeRate
  }

  const broadcastFn = provider.broadcast.bind(provider)
  provider.broadcast = async (rawtx: string) => {
    try {
      const txid = await broadcastFn(rawtx)
      console.log('broadcast success, txid: ', txid)
      return txid
    } catch (error) {
      console.log('broadcast error, rawtx: ', rawtx)
      console.log(error)
      throw error
    }
  }

  return provider
}

export const testProvider = createTestProvider()
