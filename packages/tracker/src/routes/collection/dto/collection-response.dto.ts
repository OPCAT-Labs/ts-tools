import { ApiProperty } from '@nestjs/swagger';


export class BaseResponse<T> {
  @ApiProperty({ example: 0, description: 'Response code, 0 for success' })
  code: number;

  @ApiProperty({ example: 'OK', description: 'Response message' })
  msg: string;

  @ApiProperty({ description: 'Response data' })
  data: T;
}

export class CollectionInfo {
  @ApiProperty({ example: '70ae652604e657bed6b9f0cfe6ccee343539d498f79149023114bebe9439f05a_0', description: 'Collection ID' })
  collectionId: string;

  @ApiProperty({ example: '397c92cbef253ad43ef737bfd60d75e2d64da5598bcf6698bae2c8810cbab3ad', description: 'Genesis transaction ID' })
  genesisTxid: string;

  @ApiProperty({ example: 'My Collection', description: 'Collection name' })
  name: string;

  @ApiProperty({ example: 'MC', description: 'Collection symbol' })
  symbol: string;

  @ApiProperty({ example: 'abc123...', description: 'Minter contract script hash' })
  minterScriptHash: string;

  @ApiProperty({ example: 'def456...', description: 'Collection contract script hash' })
  collectionScriptHash: string;

  @ApiProperty({ example: 100000, description: 'First mint block height' })
  firstMintHeight: number | null;

  @ApiProperty({ example: '0363617452554c8ca8637461676e3666373036333631373430313033646e616d6561636673796d626f6c61436b6465736372697074696f6e6163636d61781908346469636f6e60696d696e7465724d6435606d6973737565724164647265737378323736613931343633633137303233626235306235666664633531393161366433323765306233363864623164336338386163', description: 'Collection metadata in raw hex format' })
  metadata: string;
}

export class CollectionInfoResponse extends BaseResponse<CollectionInfo> {
  @ApiProperty({ type: CollectionInfo })
  data: CollectionInfo;
}

export class NftInfo {
  @ApiProperty({ example: '70ae652604e657bed6b9f0cfe6ccee343539d498f79149023114bebe9439f05a_0', description: 'Collection ID' })
  collectionId: string;

  @ApiProperty({ example: 0, description: 'Local ID' })
  localId: number;

  @ApiProperty({ example: '397c92cbef253ad43ef737bfd60d75e2d64da5598bcf6698bae2c8810cbab3ad', description: 'Mint transaction ID' })
  mintTxid: string;

  @ApiProperty({ example: 28456, description: 'Mint block height' })
  mintHeight: number | null;

  @ApiProperty({ example: {image: 'https://example.com/image.png', name: 'My NFT'}, description: 'NFT metadata' })
  metadata: any
}
export class NftInfoResponse extends BaseResponse<NftInfo> {
  @ApiProperty({ type: NftInfo })
  data: NftInfo;
}

export class NftUtxoState {
  @ApiProperty({ example: 'abc123......', description: 'The owner address, p2pkh script hex or locking script hash' })
  address: string
  @ApiProperty({ example: '100', description: 'NFT local ID' })
  localId: string;
}

export class Utxo {
  @ApiProperty({ example: 'faf1b996e68d25ff6a3139dca22b5bb98d34ecb55be033222d9181034d470238', description: 'Transaction ID' })
  txId: string;

  @ApiProperty({ example: 0, description: 'Output index' })
  outputIndex: number;

  @ApiProperty({ example: '41e9db63597a36bd996496fda81f229c61afb696ee7e57bc652a48254fa2da9a', description: 'the utxo locking script hash' })
  script: string;

  @ApiProperty({ example: '10000', description: 'Satoshi amount' })
  satoshis: string;

  @ApiProperty({ example: '07006f706361740105190076a91463c17023bb50b5ffdc5191a6d327e0b368db1d3c88ac0000311a4fef6e69aabb2fab5f1c818cf5359ea62f2b', description: 'utxo.data' })
  data: string;

  @ApiProperty({ type: NftUtxoState, description: 'NFT UTXO state' })
  state: NftUtxoState
}
export class UtxosData {
  @ApiProperty({ type: [Utxo], description: 'UTXOs' })
  utxos: Utxo[];

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}
export class CollectionUtxosResponse extends BaseResponse<UtxosData> {
  @ApiProperty({ type: UtxosData })
  data: UtxosData;
}

export class CollectionNftLocalIds {
  @ApiProperty({ example: ['1', '2', '3'], description: 'NFT local IDs' })
  localIds: string[];
  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}
export class CollectionNftLocalIdsResponse extends BaseResponse<CollectionNftLocalIds> {
  @ApiProperty({ type: CollectionNftLocalIds })
  data: CollectionNftLocalIds;
}

export class NftUtxoData {
  @ApiProperty({ type: Utxo, description: 'NFT UTXO' })
  utxo: Utxo;

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}
export class NftUtxoResponse extends BaseResponse<NftUtxoData> {
  @ApiProperty({ type: NftUtxoData })
  data: NftUtxoData;
}

export class CollectionBalance {
  @ApiProperty({ example: '70ae652604e657bed6b9f0cfe6ccee343539d498f79149023114bebe9439f05a_0', description: 'Collection ID' })
  collectionId: string;

  @ApiProperty({ example: 5, description: 'NFT balance amount' })
  confirmed: number;
}

export class CollectionBalanceData extends CollectionBalance {
  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}
export class CollectionBalanceResponse extends BaseResponse<CollectionBalanceData> {
  @ApiProperty({ type: CollectionBalanceData })
  data: CollectionBalanceData;
}

export class CollectionMintAmount {
  @ApiProperty({ example: '5000000000', description: 'Total mint amount' })
  amount: string
  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number
}
export class CollectionMintAmountResponse extends BaseResponse<CollectionMintAmount> {
  @ApiProperty({ type: CollectionMintAmount })
  data: CollectionMintAmount;
}

export class CollectionTotalSupply {
  @ApiProperty({ example: '5000000000', description: 'Total supply amount' })
  amount: string
  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number
}
export class CollectionTotalSupplyResponse extends BaseResponse<CollectionTotalSupply> {
  @ApiProperty({ type: CollectionTotalSupply })
  data: CollectionTotalSupply;
}

export class NftHolder {
  @ApiProperty({ example: 'abc123......', description: 'p2pkh lockingScript or script hash' })
  ownerPubKeyHash: string;
  @ApiProperty({ example: '5', description: 'nft balance, how many NFTs held by the owner' })
  balance: string;
  @ApiProperty({ example: 1, description: 'Rank by NFT amount held' })
  rank: number;
  @ApiProperty({ example: 0.5, description: 'Percentage of total NFTs held' })
  percentage: number;
}
export class NftHolderData {
  @ApiProperty({ type: [NftHolder], description: 'NFT holders' })
  holders: NftHolder[];

  @ApiProperty({ example: 1000, description: 'Total number of token holders' })
  total: number;

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number
}
export class NftHolderResponse extends BaseResponse<NftHolderData> {
  @ApiProperty({ type: NftHolderData })
  data: NftHolderData;
}