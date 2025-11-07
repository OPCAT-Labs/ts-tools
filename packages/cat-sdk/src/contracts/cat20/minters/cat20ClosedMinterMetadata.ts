import { StateLib } from '@opcat-labs/scrypt-ts-opcat'
import { ClosedMinterCAT20Meta } from '../types'
import { ConstantsLib } from '../../constants'

/**
 * The CAT20 closed minter metadata helper
 * @category CAT20
 * @category Metadata
 */
export class CAT20ClosedMinterMetadata extends StateLib<ClosedMinterCAT20Meta> {
  static createEmptyMetadata(): ClosedMinterCAT20Meta {
    return {
      name: '',
      symbol: '',
      decimals: 0n,
      hasAdmin: false,
      minterMd5: '',
    }
  }
}
