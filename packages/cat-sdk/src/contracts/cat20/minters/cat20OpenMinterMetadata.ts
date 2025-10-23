import { OpenMinterCAT20Meta } from "../types";
import { ConstantsLib } from "../../constants";


/**
 * The CAT20 open minter metadata helper
 * @category CAT20
 * @category Metadata
 */
export class CAT20OpenMinterMetadata {

  static createEmptyMetadata(): OpenMinterCAT20Meta {
    return {
      name: '',
      symbol: '',
      decimals: 0n,
      minterMd5: '',
      max: 0n,
      limit: 0n,
      premine: 0n,
      preminerAddr: '',
    }
  }
}