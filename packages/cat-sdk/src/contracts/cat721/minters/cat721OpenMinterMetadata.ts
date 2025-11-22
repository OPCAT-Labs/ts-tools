import { OpenMinterCAT721Meta } from "../types.js";


/**
 * The CAT721 open minter metadata helper
 * @category CAT721
 * @category Metadata
 */
export class CAT721OpenMinterMetadata {
    static createEmptyMetadata(): OpenMinterCAT721Meta {
        return {
            name: '',
            symbol: '',
            description: '',
            max: 0n,
            premine: 0n,
            preminerAddr: '',
        }
    }
}
