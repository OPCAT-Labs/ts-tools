import { HashedMap, ByteString, SmartContract, method, assert, TxUtils, hash160, PubKey, Sig, StateLib } from '@opcat-labs/scrypt-ts-opcat';


export type ClaimInfo = {
    amount: bigint;
    claimed: boolean;
}

export type AirdropBTCState = {
    // address(p2pkh script) -> claimInfo
    claimInfos: HashedMap<ByteString, ClaimInfo, 1>
}

export class AirdropBTCStateLib extends StateLib<AirdropBTCState> {
}

export class AirdropBTC extends SmartContract<AirdropBTCState> {

    @method()
    public claim(
        // the p2pkh script
        address: ByteString,
    ) {
       const claimInfo = this.state.claimInfos.get(address);
       assert(!claimInfo.claimed, 'Already claimed');

       const amount = claimInfo.amount;
       assert(amount > 0n, 'Amount is 0');

       claimInfo.claimed = true;
       this.state.claimInfos.set(address, claimInfo);

       const nextOutput = TxUtils.buildDataOutput(this.ctx.spentScriptHash, this.ctx.value - amount, AirdropBTC.stateHash(this.state));
       const claimOutput = TxUtils.buildOutput(address, amount);

       const outputs = nextOutput + claimOutput + this.buildChangeOutput();
       assert(this.checkOutputs(outputs), 'Outputs is not valid');
    }
}