import { StateLib, method, assert, ByteString } from "@opcat-labs/scrypt-ts-opcat";
import { CAT20_AMOUNT, CAT20State } from "./types";
import { OwnerUtils } from "../utils/ownerUtils";
import { ConstantsLib } from "../constants";

/**
 * The CAT20 state library
 * @category Contract
 * @category CAT20
 * @onchain
 */
export class CAT20StateLib extends StateLib<CAT20State> {
    @method()
    static checkState(_state: CAT20State): void {
        OwnerUtils.checkOwnerAddr(_state.ownerAddr);
        assert(_state.amount > 0n, 'token amount should be non-negative');
    }

    static create(amount: CAT20_AMOUNT, address: ByteString): CAT20State {
        return {
            amount,
            ownerAddr: address,
        }
    }
}
