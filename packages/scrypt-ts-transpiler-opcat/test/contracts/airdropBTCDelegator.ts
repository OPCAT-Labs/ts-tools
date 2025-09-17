import { assert, ByteString, ContextUtils, hash160, HashedMap, method, PubKey, sha256, Sig, SmartContract, toByteString, TxUtils } from '@opcat-labs/scrypt-ts-opcat'
import { AirdropBTCStateLib, AirdropBTCState } from './airdropBTCStateLib.js'

export type AirdropBTCDelegatorState = {
    // claimerAddress -> delegatorAddress
    delegators: HashedMap<ByteString, ByteString, 1>
}
export class AirdropBTCDelegator extends SmartContract<AirdropBTCDelegatorState> {
    @method()
    public unlock(
        airdropState: AirdropBTCState,
        claimerAddress: ByteString,
        delegatorPubKey: PubKey,
        delegatorSig: Sig,
    ) {
        assert(
            ContextUtils.getSpentDataHash(this.ctx.spentDataHashes, 0n) == AirdropBTCStateLib.stateHash(airdropState),
        )

        const expectDelegatorAddress = this.state.delegators.get(claimerAddress);
        assert(expectDelegatorAddress != toByteString(''), 'No delegator address found');
        this.state.delegators.set(claimerAddress, toByteString(''));

        const delegatorAddress = TxUtils.buildP2PKHScript(hash160(delegatorPubKey));
        assert(delegatorAddress == expectDelegatorAddress, 'Invalid delegator address');
        this.checkSig(delegatorSig, delegatorPubKey);

        const claimInfo = airdropState.claimInfos.get(claimerAddress);
        assert(!claimInfo.claimed, 'Claim already claimed');

        claimInfo.claimed = true;
        airdropState.claimInfos.set(claimerAddress, claimInfo);

        // the first input is the airdropBTC contract
        const airdropScriptHash = ContextUtils.getSpentScriptHash(this.ctx.spentScriptHashes, 0n);
        const airdropDataHash = AirdropBTCStateLib.stateHash(airdropState);
        const airdropValue = ContextUtils.getSpentAmount(this.ctx.spentAmounts, 0n);
        const claimerOutput = TxUtils.buildOutput(sha256(claimerAddress), claimInfo.amount);
        const changeOutput = this.buildChangeOutput();

        const airdropContractOutput = TxUtils.buildDataOutput(airdropScriptHash, airdropValue - claimInfo.amount, airdropDataHash);

        const outputs =airdropContractOutput + claimerOutput + changeOutput;
        assert(this.checkOutputs(outputs), 'Outputs is not valid');

    }
}