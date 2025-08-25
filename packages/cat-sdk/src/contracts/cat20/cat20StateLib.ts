import { StateLib, method, assert, ByteString } from "@opcat-labs/scrypt-ts";
import { CAT20_AMOUNT, CAT20State } from "./types";
import { OwnerUtils } from "../utils/ownerUtils";
import { ConstantsLib } from "../constants";

export class CAT20StateLib extends StateLib<CAT20State> {
    @method()
    static checkState(_state: CAT20State): void {
        OwnerUtils.checkOwnerAddr(_state.ownerAddr);
        assert(_state.amount > 0n, 'token amount should be non-negative');
        assert(_state.tag == ConstantsLib.OPCAT_CAT20_TAG, 'invalid tag');
    }

    static create(amount: CAT20_AMOUNT, address: ByteString): CAT20State {
        return {
            tag: ConstantsLib.OPCAT_CAT20_TAG,
            amount,
            ownerAddr: address,
        }
    }
}
