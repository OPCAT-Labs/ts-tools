import { ByteString, FixedArray, PubKey, Sig } from '@opcat-labs/scrypt-ts-opcat';
import { TX_OUTPUT_COUNT_MAX } from './constants';

/**
 * The arguments to unlock a token UTXO or a nft UTXO
 * @category Types
 * @onchain
 */
export type ContractUnlockArgs = {
    // user spend args
    userPubKey: PubKey
    userSig: Sig
    // contract spend arg
    contractInputIndex: bigint;
};

/**
 * The state hashes for the CAT contracts
 * @category Contract
 * @category Types
 * @onchain
 */
export type StateHashes = FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>