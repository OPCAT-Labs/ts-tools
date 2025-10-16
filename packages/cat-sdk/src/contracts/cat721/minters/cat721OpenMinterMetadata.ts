import { StateLib } from "@opcat-labs/scrypt-ts-opcat";
import { OpenMinterCAT721Meta } from "../types";
import { ConstantsLib } from "../../constants";


/**
 * The CAT721 open minter metadata helper
 * @category CAT721
 * @category Metadata
 */
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