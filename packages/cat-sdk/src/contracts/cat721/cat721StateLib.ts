import { CAT721State } from "./types.js";
import { OwnerUtils } from "../utils/ownerUtils.js";
import { ConstantsLib } from "../constants.js";
import { StateLib, method, assert, ByteString } from "@opcat-labs/scrypt-ts-opcat";

/**
 * The CAT721 state library
 * @category Contract
 * @category CAT721
 * @onchain
 */
export class CAT721StateLib extends StateLib<CAT721State> {
    @method()
    static checkState(_state: CAT721State): void {
        OwnerUtils.checkOwnerAddr(_state.ownerAddr);
        assert(_state.localId >= 0n, 'localId should be non-negative');
    }

    static create(localId: bigint, address: ByteString): CAT721State {
        return {
            localId,
            ownerAddr: address,
        }
    }
}
