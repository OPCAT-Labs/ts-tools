import { CAT721State } from "./types";
import { OwnerUtils } from "../utils/ownerUtils";
import { ConstantsLib } from "../constants";
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
        assert(_state.tag == ConstantsLib.OPCAT_CAT721_TAG, 'invalid tag');
        assert(_state.localId >= 0n, 'localId should be non-negative');
    }

    static create(localId: bigint, address: ByteString): CAT721State {
        return {
            tag: ConstantsLib.OPCAT_CAT721_TAG,
            localId,
            ownerAddr: address,
        }
    }
}
