import {
  TX_INPUT_COUNT_MAX,
  TX_OUTPUT_COUNT_MAX,
  TX_HASH_PREIMAGE2_SUFFIX_ARRAY_SIZE,
} from '../consts.js';
import { ByteString, FixedArray, Int32 } from './primitives.js';

/**
 * The structure used to refer to a particular transaction output
 * @category Types
 * @onchain
 */
export type Outpoint = {
  /**
   * The transaction hash, which is the reverse order of bytes of the `txId`.
   */
  txHash: ByteString;

  /**
   * The index of the output in the transaction.
   */
  outputIndex: ByteString;
};

/**
 * A structure representing a transaction output
 * @category Types
 * @onchain
 */
export type TxOut = {
  script: ByteString;
  satoshis: ByteString;
};

/**
 * A structure representing the transaction input, excluding witnesses
 * @category Types
 * @onchain
 */
export type TxIn = {
  prevTxHash: ByteString;
  prevOutputIndexVal: Int32;
  sequence: ByteString;
};

/**
 * transaction digest for signature verification, @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#signature-validation-rules | BIP341}
 * @category Types
 * @onchain
 */
export type SHPreimage = {
  /**
   * 4 bytes.
   * version number of the transaction
   * nVersion defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  nVersion: Int32;

  /**
   * 32 bytes.
   * the double SHA256 of the serialization of all input outpoints.
   * If the ANYONECANPAY SIGHASH type is not set, it's double SHA256 of the serialization of all input outpoints.
   * Otherwise, it's a uint256 of 0x0000......0000.
   * sha_prevouts defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  hashPrevouts: ByteString;

  /** scriptHash of the input (serialized as scripts inside CTxOuts) */
  spentScriptHash: ByteString;

  /** dataHash of the input (serialized as scripts inside CTxOuts) */
  spentDataHash: ByteString;

  /** value of the output spent by this input (8-byte little endian) */
  spentAmount: Int32;

  /** nSequence of the input (4-byte little endian) */
  sequence: Int32;

  /**
   * 32 bytes.
   * the SHA256 of the serialization of all input amounts.
   * sha_amounts defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  hashSpentAmounts: ByteString;

  /**
   * 32 bytes.
   * the SHA256 of all spent outputs' scriptPubKeys, serialized as script inside CTxOut
   * sha_scriptpubkeys defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  hashSpentScripts: ByteString;

  /**  */
  hashSpentDatas: ByteString;

  /**
   * 32 bytes.
   * the SHA256 of the serialization of all input nSequence.
   * sha_sequences defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  hashSequences: ByteString;

  /**
   * 32 bytes
   * the SHA256 of the serialization of all outputs.
   * sha_outputs defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  hashOutputs: ByteString;

  /**
   * 4 bytes
   * index of this input in the transaction input vector. Index of the first input is 0x00000000.
   * input_index defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  inputIndex: Int32;

  /**
   * 4 bytes.
   * locktime of the transaction
   * nLockTime defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  nLockTime: Int32;

  /** sighash type of the signature (4-byte little endian) */
  sighashType: Int32;

};

/**
 * An array refers to the outputs from previous transactions that are being spent as inputs in the current transaction.
 * @category Types
 * @onchain
 */
export type Prevouts = FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;

/**
 * The context of the spent scripts.
 * spentScripts is an array of the spent scripts, that is the script of the previous output. [spentScript1, spentScript2, ...], length is MAX_INPUT. The rest is empty ByteString if inputs are less than MAX_INPUT.
 * each non-empty element is a ByteString, which is the script of the previous output.
 * @category Types
 * @onchain
 */
export type SpentScripts = FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;

/**
 * The context of the spent amounts.
 * spentAmounts is an array of the spent amounts, that is the amount of the previous output. [spentAmount1, spentAmount2, ...], length is MAX_INPUT. The rest is empty ByteString if inputs are less than MAX_INPUT.
 * each non-empty element is a ByteString of 8 bytes, which is the amount of the previous output.
 * @category Types
 * @onchain
 */
export type SpentAmounts = FixedArray<Int32, typeof TX_INPUT_COUNT_MAX>;


export type SpentDatas = FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;

/**
 * An array of hashes representing the states of all stateful covenants included in the transaction.
 * A transaction output can contain up to 5 stateful covenants.
 * @category Types
 * @onchain
 */
export type SpentDataHashes = FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;


/**
 * The digest data used to calculate the Traditional Transaction ID (txid) consists of the transaction's
 * core components (inputs, outputs) without the witness information.
 * @category Types
 * @onchain
 */
export type TxHashPreimage = {
  version: ByteString;
  inputCount: ByteString;
  inputPrevTxHashList: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;
  inputPrevOutputIndexList: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;
  inputScriptList: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;
  inputSequenceList: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;
  outputCount: ByteString;
  outputSatoshisList: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>;
  outputScriptLenList: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>;
  outputScriptList: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>;
  locktime: ByteString;
};

/**
 * Same as `TxHashPreimage`, but more compact because it incorporates data about the inputs included in the transaction
 * @category Types
 * @onchain
 */
export type CompactTxHashPreimage = {
  // version
  version: ByteString;
  // the number of inputs
  inputCountVal: Int32;
  // input list, each element represents an individual input
  inputList: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;
  // the number of outputs
  outputCountVal: Int32;
  // output list
  outputSatoshisList: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>;
  outputScriptList: FixedArray<ByteString, typeof TX_OUTPUT_COUNT_MAX>;
  // locktime
  locktime: ByteString;
};

/**
 * Same as `CompactTxHashPreimage`, but can more easily parse out the HashRoot contained in the transaction
 * @onchain
 * @category Types
 */
export type HashRootTxHashPreimage = {
  // version
  version: ByteString;
  // the number of inputs
  inputCountVal: Int32;
  // input list, each element represents an individual input
  inputList: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;
  // the number of outputs
  outputCountVal: Int32;
  // state hash root, used to build the first output
  hashRoot: ByteString;
  // suffixes, including outputs except for the first output, and lock time,
  // elements are split by byte length
  suffixList: FixedArray<ByteString, typeof TX_HASH_PREIMAGE2_SUFFIX_ARRAY_SIZE>;
};

/**
 * Used for contract traceability to ensure that the spent contract comes from a unique outpoint
 * @category Types
 * @onchain
 */
export type BacktraceInfo = {
  /**
   * @type {TxIn}
   * the traceable input in the previous transaction
   */
  prevTxInput: TxIn;

  /**
   * @type {Int32}
   * the index of the traceable input in the previous transaction
   */
  prevTxInputIndexVal: Int32;

  /**
   * @type {CompactTxHashPreimage}
   * the preimage of the previous previous transaction
   */
  prevPrevTxPreimage: CompactTxHashPreimage;
};


