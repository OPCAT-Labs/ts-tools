import { ByteString, FixedArray, PubKey, Sig } from '@opcat-labs/scrypt-ts';
import { TX_OUTPUT_COUNT_MAX } from './constants';

// args to unlock a token UTXO or a nft UTXO
export type ContractUnlockArgs = {
    // user spend args
    userPubKey: PubKey
    userSig: Sig
    // contract spend arg
    contractInputIndex: bigint;
};

export type StateHashes = FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>