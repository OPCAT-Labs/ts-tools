import { ByteString, Int32, UInt32, UInt64 } from './primitives.js';

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
  outputIndex: UInt32;
};

/**
 * A structure representing a transaction output
 * @category Types
 * @onchain
 */
export type TxOut = {
  scriptHash: ByteString;
  dataHash: ByteString;
  satoshis: UInt64;
};

/**
 * A structure representing the transaction input, excluding witnesses
 * @category Types
 * @onchain
 */
export type TxIn = {
  /**
   * 32 bytes.
   * input's prevout transaction hash
   */
  prevTxHash: ByteString;

  /**
   * 4 bytes little endian.
   * input's prevout output index
   */
  prevOutputIndex: UInt32;

  /**
   * 4 bytes little endian.
   * input's sequence number
   */
  sequence: UInt32;

  /**
   * 32 bytes.
   * input's unlocking script hash
   */
  scriptHash: ByteString;
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
   */
  nVersion: ByteString;

  /**
   * 32 bytes.
   * hash256(prevout0 + prevout1 + ... + prevoutN)
   */
  hashPrevouts: ByteString;

  /**
   * 32 bytes.
   * current input's prevout script hash, SHA256
   */
  spentScriptHash: ByteString

  /**
   * 32 bytes.
   * current input's prevout data hash, SHA256
   */
  spentDataHash: ByteString;

  /**
   * 8 bytes little endian. spent amount;
   */
  value: UInt64;

  /**
   * 4 bytes little endian.
   */
  nSequence: ByteString;

  /**
   * 32 bytes.
   * hash256(spentAmount0(8 bytes, little endian) + spentAmount1 + ... + spentAmountN)
   */
  hashSpentAmounts: ByteString;

  /**
   * 32 bytes.
   * hash256(spentScriptHash0(32 bytes) + spentScriptHash1 + ... + spentScriptHashN)
   */
  hashSpentScriptHashes: ByteString;

  /**
   * 32 bytes.
   * hash256(spentDataHash0(32 bytes) + spentDataHash1 + ... + spentDataHashN)
   */
  hashSpentDataHashes: ByteString;

  /**
   * 32 bytes.
   * hash256(sequence0(4 bytes, little endian) + sequence1 + ... + sequenceN)
   */
  hashSequences: ByteString;

  /**
   * 32 bytes.
   * hash256(output0(value(8 bytes, little endian) + scriptHash(32 bytes) + dataHash(32 bytes)) + output1 + ... + outputN)
   */
  hashOutputs: ByteString;

  /**
   * 4 bytes little endian.
   */
  inputIndex: UInt32;


  /**
   * 4 bytes little endian.
   */
  nLockTime: UInt32;

  /**
   * 4 bytes little endian.
   */
  sigHashType: UInt32
};

/**
 * An bytestring refers to the outputs from previous transactions that are being spent as inputs in the current transaction.
 * prevout = prevTxHash(32 bytes) + prevOutputIndex(4 bytes)
 * prevouts1 + prevouts2 + ... + prevoutsN
 * @category Types
 * @onchain
 */
export type Prevouts = ByteString;

/**
 * The context of the spent scripts.
 * spentScriptHash = scriptHash(32 bytes)
 * spentScriptHash1 + spentScriptHash2 + ... + spentScriptHashN
 * @category Types
 * @onchain
 */
export type SpentScriptHashes = ByteString;

/**
 * The context of the spent data hashes.
 * spentDataHash = dataHash(32 bytes)
 * spentDataHash1 + spentDataHash2 + ... + spentDataHashN
 * @category Types
 * @onchain
 */
export type SpentDataHashes = ByteString;

/**
 * The context of the spent amounts.
 * spentAmount = amount(8 bytes)
 * spentAmount1 + spentAmount2 + ... + spentAmountN
 * @category Types
 * @onchain
 */
export type SpentAmounts = ByteString;



/**
 * The digest data used to calculate the Traditional Transaction ID (txid) consists of the transaction's
 * core components (inputs, outputs) without the witness information.
 * @category Types
 * @onchain
 */
export type TxHashPreimage = {
  /**
   * 4 bytes little endian.
   */
  version: ByteString;

  /**
   * input = prevout(36 bytes) + unlockScriptHash(32 bytes) + sequence(4 bytes)
   * input1 + input2 + ... + inputN
   */
  inputList: ByteString;

  /**
   * output = amount(8 bytes) + lockingScriptHash(32 bytes) + dataHash(32 bytes)
   * output1 + output2 + ... + outputN
   */
  outputList: ByteString;

  /**
   * 4 bytes little endian.
   */
  nLockTime: ByteString;
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
  prevTxInputIndex: Int32;

  /**
   * @type {TxHashPreimage}
   * the preimage of the previous previous transaction
   */
  prevPrevTxPreimage: TxHashPreimage;
};

export type __ScryptInternalHashedMap__ = {
  _root: ByteString;
}
