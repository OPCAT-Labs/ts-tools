import { ClosedMinterCAT20Meta } from "../types";
import { ConstantsLib } from "../../constants";


/**
 * The CAT20 closed minter metadata helper
 * @category CAT20
 * @category Metadata
 */
export class CAT20ClosedMinterMetadata {
    static createEmptyMetadata(): ClosedMinterCAT20Meta {
        return {
            tag: ConstantsLib.OPCAT_CAT20_METADATA_TAG,
            name: '',
            symbol: '',
            decimals: 0n,
            minterMd5: '',
        }
    }
}