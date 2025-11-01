import { StateLib } from '@opcat-labs/scrypt-ts-opcat'
import { ClosedMinterCAT20Meta } from '../types'
import { ConstantsLib } from '../../constants'

export class CAT20ClosedMinterMetadata extends StateLib<ClosedMinterCAT20Meta> {
  static createEmptyMetadata(): ClosedMinterCAT20Meta {
    return {
      tag: ConstantsLib.OPCAT_METADATA_TAG,
      name: '',
      symbol: '',
      decimals: 0n,
      hasAdmin: false,
      minterMd5: '',
    }
  }
}
