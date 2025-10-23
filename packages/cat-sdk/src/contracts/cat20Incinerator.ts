import { assert, ByteString, ContextUtils, prop, method, SmartContract } from "@opcat-labs/scrypt-ts-opcat";
import { CAT20GuardConstState } from "./cat20/types";
import { CAT20Guard } from "./cat20/cat20Guard";
import { GUARD_TOKEN_TYPE_MAX } from "./constants";
import { CAT20GuardStateLib } from "./cat20/cat20GuardStateLib";


/**
 * The CAT20 incinerator contract, used to incinerate the CAT20 token
 * @category Contract
 * @category CAT20
 * @onchain
 */
export class CAT20Incinerator extends SmartContract {
    @prop()
    cat20GuardScriptHash: ByteString

    constructor(
        cat20GuardScriptHash: ByteString,
    ) {
        super(...arguments)
        this.cat20GuardScriptHash = cat20GuardScriptHash
    }

    @method()
    public incinerate(
        guardInputIndex: bigint,
        guardState: CAT20GuardConstState
    ) {

        // 1. verify guardInputIndex is the cat20Guard script hash
        const currentGuardScriptHash = ContextUtils.getSpentScriptHash(this.ctx.spentScriptHashes, guardInputIndex)
        assert(currentGuardScriptHash == this.cat20GuardScriptHash)   
        const currentGuardStateHash = ContextUtils.getSpentDataHash(this.ctx.spentDataHashes, guardInputIndex)
        assert(CAT20GuardStateLib.stateHash(guardState) == currentGuardStateHash);

        // 3. make sure the guard burn all the tokens
        for (let i = 0; i < GUARD_TOKEN_TYPE_MAX; i++) {
            assert(guardState.tokenAmounts[i] == guardState.tokenBurnAmounts[i])
        }
        assert(true);
    }
}