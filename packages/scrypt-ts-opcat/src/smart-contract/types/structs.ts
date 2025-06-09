import {
  STATE_OUTPUT_COUNT_MAX,
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
  nVersion: ByteString;

  /**
   * 4 bytes.
   * locktime of the transaction
   * nLockTime defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  nLockTime: ByteString;

  /**
   * 32 bytes.
   * the SHA256 of the serialization of all input outpoints.
   * If the ANYONECANPAY SIGHASH type is not set, it's double SHA256 of the serialization of all input outpoints.
   * Otherwise, it's a uint256 of 0x0000......0000.
   * sha_prevouts defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  shaPrevouts: ByteString;

  /**
   * 32 bytes.
   * the SHA256 of the serialization of all input amounts.
   * sha_amounts defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  shaSpentAmounts: ByteString;

  /**
   * 32 bytes.
   * the SHA256 of all spent outputs' scriptPubKeys, serialized as script inside CTxOut
   * sha_scriptpubkeys defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  shaSpentScripts: ByteString;

  /**
   * 32 bytes.
   * the SHA256 of the serialization of all input nSequence.
   * sha_sequences defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  shaSequences: ByteString;

  /**
   * 32 bytes
   * the SHA256 of the serialization of all outputs.
   * sha_outputs defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  shaOutputs: ByteString;

  /**
   * 1 byte.
   * equal to (ext_flag * 2) + annex_present, where annex_present is 0 if no annex is present, or 1 otherwise (the original witness stack has two or more witness elements, and the first byte of the last element is 0x50)
   * spendType defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  spendType: ByteString;

  /**
   * 4 bytes
   * index of this input in the transaction input vector. Index of the first input is 0x00000000.
   * input_index defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message | BIP341}
   */
  inputIndex: ByteString;

  /**
   * 32 bytes.
   * the tap leaf hash of the input
   * tapleaf_hash defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki#common-signature-message-extension | BIP342}
   */
  tapLeafHash: ByteString;

  /**
   * 1 byte.
   * a constant value 0x00 representing the current version of public keys in the tapscript signature opcode execution.
   * key_version defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki#common-signature-message-extension | BIP342}
   */
  keyVersion: ByteString;

  /**
   * 4 bytes.
   * the opcode position of the last executed OP_CODESEPARATOR before the currently executed signature opcode, with the value in little endian (or 0xffffffff if none executed). The first opcode in a script has a position of 0. A multi-byte push opcode is counted as one opcode, regardless of the size of data being pushed. Opcodes in parsed but unexecuted branches count towards this value as well.
   * codesep_pos defined in @see {@link https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki#common-signature-message-extension | BIP342}
   */
  codeSepPos: ByteString;

  /**
   * 31 bytes
   * e is sha256 of the sighash, but without last byte
   */
  _eWithoutLastByte: ByteString;

  /**
   * 1 bytes
   * last byte of e
   */
  _eLastByte: Int32;
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
export type SpentAmounts = FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>;

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
 * An array of hashes representing the states of all stateful covenants included in the transaction.
 * A transaction output can contain up to 5 stateful covenants.
 * @category Types
 * @onchain
 */
export type StateHashes = FixedArray<ByteString, typeof STATE_OUTPUT_COUNT_MAX>;

/**
 * A structure used to verify the contract state contained in the input
 * @category Types
 * @onchain
 */
export type InputStateProof = {
  /**
   * @type {HashRootTxHashPreimage}
   * the preimage of the previous transaction
   */
  txHashPreimage: HashRootTxHashPreimage;

  /**
   * @type {Int32}
   * index of this output in the transaction output vector. Starts from 0.
   */
  outputIndexVal: Int32;

  /**
   * @type {StateHashes}
   * the txo state hashes of the previous transaction
   */
  stateHashes: StateHashes;
};

/**
 * A array representing all input state proofs
 * @category Types
 * @onchain
 */
export type InputStateProofs = FixedArray<InputStateProof, typeof TX_INPUT_COUNT_MAX>;

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
