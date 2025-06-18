import {
  SmartContract,
  method,
  StructObject,
  Int32,
  PubKey,
  Sig,
  Sha1,
  Sha256,
  Bool,
  ByteString,
  XOnlyPubKey,
  Ripemd160,
  OpCodeType,
  FixedArray,
  TxUtils,
  assert,
  sha256,
} from '@opcat-labs/scrypt-ts-opcat';

export const enum CustomEnum {
  Value1,
  Value2,
  Value3,
  Value4,
}

export const enum CustomEnum2 {
  Value1 = 'value1',
  Value2 = 'value2',
  Value3 = 'value3',
  Value4 = 'value4',
}

export interface CustomStruct extends StructObject {
  structInt32: Int32;
  structBigint: bigint;
  structBool: Bool;
  structBool2: boolean;
  structByteString: ByteString;
}

export interface StateTypeState extends StructObject {
  // all primitive types are supported
  int32: Int32;
  // bigint is supported, but recommend using int32 instead
  bi: bigint;
  byteString: ByteString;
  // string is not supported, use ByteString instead
  // str: string;
  bool: Bool;
  // boolean is supported, but recommend using Bool instead
  bool2: boolean;

  sha256: Sha256;
  sha1: Sha1;
  sig: Sig;
  pubKey: PubKey;
  xOnlyPubKey: XOnlyPubKey;
  // enum type is not supported
  // sigHashType: SigHashType;
  ripemd160: Ripemd160;
  opCodeType: OpCodeType;
  // all array types are supported
  fixedArrayInt32: FixedArray<Int32, 2>;
  fixedArrayBigint: FixedArray<bigint, 2>;
  fixedArrayByteString: FixedArray<ByteString, 2>;
  fixedArrayBool: FixedArray<Bool, 2>;
  fixedArrayBool2: FixedArray<boolean, 2>;
  fixedArraySha256: FixedArray<Sha256, 2>;
  fixedArraySha1: FixedArray<Sha1, 2>;
  fixedArraySig: FixedArray<Sig, 2>;
  fixedArrayPubKey: FixedArray<PubKey, 2>;
  fixedArrayXOnlyPubKey: FixedArray<XOnlyPubKey, 2>;
  // enum type is not supported
  // fixedArraySigHashType: FixedArray<SigHashType, 2>;

  fixedArrayRipemd160: FixedArray<Ripemd160, 2>;
  fixedArrayOpCodeType: FixedArray<OpCodeType, 2>;

  // struct type is supported
  subStruct: CustomStruct;
  fixedArrayStruct: FixedArray<CustomStruct, 2>;

  // multi-dimensional array is supported
  y: FixedArray<FixedArray<Int32, 2>, 2>;
  z: FixedArray<FixedArray<ByteString, 2>, 2>;

  // enum type is currently not supported
  // customEnum: CustomEnum;
  // fixedArrayCustomEnum: FixedArray<CustomEnum, 2>;
  // customEnum2: CustomEnum2;
}

export class StateType extends SmartContract<StateTypeState> {
  @method()
  public unlock() {
    this.appendStateOutput(
      TxUtils.buildOutput(this.ctx.spentScript, this.ctx.spentAmount),
      StateType.stateHash(this.state),
    );
    const outputs = this.buildStateOutputs() + this.buildChangeOutput();
    assert(sha256(outputs) === this.ctx.shaOutputs, `output hash mismatch`);
  }
}
