import { ClosedMinterCAT20Meta } from '../types.js'

/**
 * The CAT20 closed minter metadata helper
 * @category CAT20
 * @category Metadata
 */
export class CAT20ClosedMinterMetadata {
  static createEmptyMetadata(): ClosedMinterCAT20Meta {
    return {
      name: '',
      symbol: '',
      decimals: 0n,
      hasAdmin: false,
    }
  }
}
