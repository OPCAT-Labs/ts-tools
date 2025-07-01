import {
  assert,
  intToByteString,
  len,
  toByteString,
  OpCode,
  ByteString,
  FixedArray,
  Int32,
  Addr,
  method,
  prop,
  SmartContractLib,
  PubKey,
} from '@opcat-labs/scrypt-ts-opcat';

type ChangeInfo = {
  script: ByteString;
  satoshis: ByteString;
};

const TX_INPUT_COUNT_MAX = 6;
const TX_P2TR_OUTPUT_SCRIPT_BYTE_LEN = 107;

export class UtilsA extends SmartContractLib {
  @prop()
  static readonly ZEROSAT: ByteString = toByteString('0000000000000000');

  @method()
  static mergePrevouts(prevouts: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>): ByteString {
    let result = toByteString('');
    for (let index = 0; index < TX_INPUT_COUNT_MAX; index++) {
      const prevout = prevouts[index];
      result += prevout;
    }
    return result;
  }

  @method()
  static mergeSpentScripts(spentScriptsCtx: FixedArray<ByteString, typeof TX_INPUT_COUNT_MAX>): ByteString {
    let result = toByteString('');
    for (let index = 0; index < TX_INPUT_COUNT_MAX; index++) {
      const spentScript = spentScriptsCtx[index];
      result += intToByteString(len(spentScript)) + spentScript;
    }
    return result;
  }

  @method()
  static buildOutput(script: ByteString, satoshis: ByteString): ByteString {
    const nlen = len(script);
    assert(nlen <= TX_P2TR_OUTPUT_SCRIPT_BYTE_LEN);
    return satoshis + intToByteString(nlen) + script;
  }

  @method()
  static checkIndex(indexVal: Int32, index: ByteString): boolean {
    let indexByte = intToByteString(indexVal);
    if (indexByte == toByteString('')) {
      indexByte = toByteString('00');
    }
    return indexByte + toByteString('000000') == index;
  }

  @method()
  static buildOpReturnOutput(data: ByteString): ByteString {
    const script = toByteString('6a') + intToByteString(len(data)) + data;
    return toByteString('0000000000000000') + intToByteString(len(script)) + script;
  }

  @method()
  static buildChangeOutput(changeInfo: ChangeInfo): ByteString {
    return changeInfo.satoshis != UtilsA.ZEROSAT
      ? UtilsA.buildOutput(changeInfo.script, changeInfo.satoshis)
      : toByteString('');
  }

  @method()
  /**
   * constructs a P2PKH script from a given PubKeyHash
   * @param {PubKeyHash} pubKeyHash - the recipient's public key hash
   * @returns {ByteString} a `ByteString` representing the P2PKH script
   */
  static buildP2PKHScript(addr: Addr): ByteString {
    return (
      toByteString(OpCode.OP_DUP) +
      toByteString(OpCode.OP_HASH160) +
      intToByteString(20n) +
      addr +
      toByteString(OpCode.OP_EQUALVERIFY) +
      toByteString(OpCode.OP_CHECKSIG)
    );
  }

  /**
   * constructs a P2PKH output from a given PubKeyHash and satoshi amount
   * @param {Addr} addr - the recipient's public key hash
   * @param {ByteString} amount - the satoshi amount
   * @returns {ByteString} a `ByteString` representing the P2PKH output
   */
  @method()
  static buildP2PKHOutput(addr: Addr, amount: ByteString): ByteString {
    return UtilsA.buildOutput(UtilsA.buildP2PKHScript(addr), amount);
  }

  @method()
  /**
   * constructs a P2WPKH script from a given PubKeyHash
   * @param {Addr} addr - the recipient's public key hash
   * @returns {ByteString} a `ByteString` representing the P2PKH script
   */
  static buildP2WPKHScript(addr: Addr): ByteString {
    return toByteString(OpCode.OP_0) + intToByteString(20n) + addr;
  }

  /**
   * constructs a P2WPKH output from a given PubKeyHash and satoshi amount
   * @param {Addr} addr - the recipient's public key hash
   * @param {ByteString} amount - the satoshi amount
   * @returns {ByteString} a `ByteString` representing the P2PKH output
   */
  @method()
  static buildP2WPKHOutput(addr: Addr, amount: ByteString): ByteString {
    return UtilsA.buildOutput(UtilsA.buildP2WPKHScript(addr), amount);
  }

  @method()
  /**
   * constructs a p2tr script from a given PubKeyHash
   * @param {XOnlyPubKey} xpubkey - the recipient's x-only key
   * @returns {ByteString} a `ByteString` representing the P2PKH script
   */
  static buildP2TRScript(xpubkey: PubKey): ByteString {
    return toByteString(OpCode.OP_1) + intToByteString(32n) + xpubkey;
  }

  /**
   * constructs a p2tr output from a given PubKeyHash and satoshi amount
   * @param {XOnlyPubKey} xpubkey - the recipient's x-only public key
   * @param {ByteString} amount - the satoshi amount
   * @returns {ByteString} a `ByteString` representing the P2PKH output
   */
  @method()
  static buildP2TROutput(xpubkey: PubKey, amount: ByteString): ByteString {
    return UtilsA.buildOutput(UtilsA.buildP2TRScript(xpubkey), amount);
  }

  @method()
  static checkInt32(i: Int32, b: ByteString): boolean {
    const iByte = intToByteString(i);
    const l = len(iByte);
    let fullByte = toByteString('');
    if (l == 0n) {
      fullByte = toByteString('00000000');
    } else if (l == 1n) {
      fullByte = iByte + toByteString('000000');
    } else if (l == 2n) {
      fullByte = iByte + toByteString('0000');
    } else if (l == 3n) {
      fullByte = iByte + toByteString('00');
    } else if (l == 4n) {
      fullByte = iByte;
    } else {
      assert(false, 'num overflow!');
    }
    return fullByte == b;
  }

  @method()
  static toSatoshis(n: Int32): ByteString {
    let int32Bytes = intToByteString(n);
    const amountBytesLen = len(int32Bytes);
    assert(amountBytesLen < 8n);
    if (amountBytesLen == 0n) {
      int32Bytes += toByteString('0000000000000000');
    } else if (amountBytesLen == 1n) {
      int32Bytes += toByteString('00000000000000');
    } else if (amountBytesLen == 2n) {
      int32Bytes += toByteString('000000000000');
    } else if (amountBytesLen == 3n) {
      int32Bytes += toByteString('0000000000');
    } else if (amountBytesLen == 4n) {
      int32Bytes += toByteString('00000000');
    } else if (amountBytesLen == 5n) {
      int32Bytes += toByteString('000000');
    } else if (amountBytesLen == 6n) {
      int32Bytes += toByteString('0000');
    } else if (amountBytesLen == 7n) {
      int32Bytes += toByteString('00');
    }
    return int32Bytes;
  }
}
