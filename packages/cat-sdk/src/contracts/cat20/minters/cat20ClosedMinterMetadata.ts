import { ClosedMinterCAT20Meta } from "../types";
import { ConstantsLib } from "../../constants";


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