import { HashedMap, ByteString, SmartContract, method, assert, TxUtils, hash160, PubKey, Sig, StateLib, sha256 } from '@opcat-labs/scrypt-ts-opcat';

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