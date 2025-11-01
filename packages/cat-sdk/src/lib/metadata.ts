import { stringToHex } from '../utils'
import { CAT20Metadata, OpenMinterCAT20Meta } from '../contracts/cat20/types'

export interface CAT20TokenInfo<T extends CAT20Metadata> {
  tokenId: string
  /** token lockingScript hash */
  tokenScriptHash: string
  /** whether the token has admin privileges */
  hasAdmin: boolean
  /** admin lockingScript hash */
  adminScriptHash: string
  /** minter lockingScript hash */
  minterScriptHash: string
  /** genesis txid */
  genesisTxid: string
  /** deploy txid */
  deployTxid: string
  /** timestamp */
  timestamp: number
  /** metadata */
  metadata: T
}

function scaleUpAmounts(metadata: OpenMinterCAT20Meta): OpenMinterCAT20Meta {
  const clone = Object.assign({}, metadata)
  clone.max = scaleUpByDecimals(metadata.max, Number(metadata.decimals))
  clone.premine = scaleUpByDecimals(metadata.premine, Number(metadata.decimals))
  clone.limit = scaleUpByDecimals(metadata.limit, Number(metadata.decimals))
  return clone
}

function hexStrings<T extends CAT20Metadata>(metadata: T): T {
  return {
    ...metadata,
    name: stringToHex(metadata.name),
    symbol: stringToHex(metadata.symbol),
  }
}

function scaleUpByDecimals(amount: bigint, decimals: number) {
  return amount * BigInt(Math.pow(10, decimals))
}

export function formatMetadata<T extends CAT20Metadata>(
  metadata: T,
  scaleUpAmount: boolean = true
) {
  let clone: T = Object.assign({}, metadata)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (scaleUpAmount && typeof (metadata as any).max === 'bigint') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clone = scaleUpAmounts(metadata as any as OpenMinterCAT20Meta) as any as T
  }
  return hexStrings(clone)
}
