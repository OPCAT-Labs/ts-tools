import { StateLib } from "@opcat-labs/scrypt-ts-opcat";
import { OpenMinterCAT721Meta } from "../types";
import { ConstantsLib } from "../../constants";


export class CAT721OpenMinterMetadata {
    static createEmptyMetadata(): OpenMinterCAT721Meta {
        return {
            tag: ConstantsLib.OPCAT_CAT721_METADATA_TAG,
            name: '',
            symbol: '',
            description: '',
            max: 0n,
            premine: 0n,
            preminerAddr: '',
            icon: '',
            minterMd5: '',
        }
    }
}