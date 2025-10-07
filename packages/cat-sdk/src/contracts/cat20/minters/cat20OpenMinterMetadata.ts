import { OpenMinterCAT20Meta } from "../types";
import { ConstantsLib } from "../../constants";


export class CAT20OpenMinterMetadata {

  static createEmptyMetadata(): OpenMinterCAT20Meta {
    return {
      tag: ConstantsLib.OPCAT_CAT20_METADATA_TAG,
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