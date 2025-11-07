import { ClosedMinterCAT721Meta } from "../types";
import { ConstantsLib } from "../../constants";

/**
 * The CAT721 closed minter metadata helper
 * @category CAT721
 * @category Metadata
 */
export class CAT721ClosedMinterMetadata {
    static createEmptyMetadata(): ClosedMinterCAT721Meta {
        return {
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