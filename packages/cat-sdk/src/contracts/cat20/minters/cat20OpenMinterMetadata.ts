import { StateLib } from "@opcat-labs/scrypt-ts-opcat";
import { OpenMinterCAT20Meta } from "../types";
import { ConstantsLib } from "../../constants";


export class CAT20OpenMinterMetadata extends StateLib<OpenMinterCAT20Meta> {
    
  static createEmptyMetadata(): OpenMinterCAT20Meta {
    return {
      tag: ConstantsLib.OPCAT_METADATA_TAG,
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