import { ClosedMinterCAT721Meta } from "../types";
import { ConstantsLib } from "../../constants";

export class CAT721ClosedMinterMetadata {
    static createEmptyMetadata(): ClosedMinterCAT721Meta {
        return {
            tag: ConstantsLib.OPCAT_CAT721_METADATA_TAG,
            name: '',
            symbol: '',
            description: '',
            max: 0n,
            icon: '',
            minterMd5: '',
            issuerAddress: '',
        }
    }
}