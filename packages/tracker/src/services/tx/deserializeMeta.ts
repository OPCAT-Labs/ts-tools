import { encoding } from '@opcat-labs/opcat';

const MD5_HASH_LEN = 16n;

const deserializeClosedMetadata = (data: Buffer) => {
  const br = new encoding.BufferReader(data);
  const nameLen = br.readUInt8();
  const name = br.read(nameLen);

  const symbolLen = br.readUInt8();
  const symbol = br.read(symbolLen);

  const metadata = {
    name: name.toString('hex'),
    symbol: symbol.toString('hex'),
    decimals: BigInt(br.readUInt8()),
    minterMd5: br.read(Number(MD5_HASH_LEN)).toString('hex'),
  };
  if (!br.eof()) {
    throw new Error('Invalid metadata');
  }
  return metadata;
};

const deserializeOpenMetadata = (data: Buffer) => {
  const br = new encoding.BufferReader(data);

  const nameLen = br.readUInt8();
  const name = br.read(nameLen);

  const symbolLen = br.readUInt8();
  const symbol = br.read(symbolLen);

  const metadata = {
    name: name.toString('hex'),
    symbol: symbol.toString('hex'),
    decimals: BigInt(br.readUInt8()),
    minterMd5: br.read(Number(MD5_HASH_LEN)).toString('hex'),
    max: BigInt(br.readUInt32LE()),
    limit: BigInt(br.readUInt32LE()),
    premine: BigInt(br.readUInt32LE()),
    preminerAddr: '',
  };

  const preminerAddrLen = br.readUInt8();
  if (preminerAddrLen > 0) {
    metadata.preminerAddr = br.read(preminerAddrLen).toString('hex');
  }
  if (!br.eof()) {
    throw new Error('Invalid metadata');
  }
  return metadata;
};

export const deserializeMetadata = (data: Buffer) => {
  try {
    return deserializeClosedMetadata(data);
  } catch (e) {}
  try {
    return deserializeOpenMetadata(data);
  } catch (e) {}
};
