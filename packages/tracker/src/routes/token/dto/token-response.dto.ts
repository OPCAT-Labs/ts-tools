import { ApiProperty } from '@nestjs/swagger';

export class BaseResponse<T> {
  @ApiProperty({ example: 0, description: 'Response code, 0 for success' })
  code: number;

  @ApiProperty({ example: 'OK', description: 'Response message' })
  msg: string;

  @ApiProperty({ description: 'Response data' })
  data: T;
}

export class TokenInfo {
  @ApiProperty({ example: '1234567890abcdef_0', description: 'Token ID' })
  tokenId: string;

  @ApiProperty({ example: '1234567890abcdef', description: 'Genesis transaction ID' })
  genesisTxid: string;

  @ApiProperty({ example: 'My Token', description: 'Token name' })
  name: string;

  @ApiProperty({ example: 'MTK', description: 'Token symbol' })
  symbol: string;

  @ApiProperty({ example: 8, description: 'Token decimals' })
  decimals: number;

  @ApiProperty({ example: 'abc123...', description: 'Minter script hash' })
  minterScriptHash: string;

  @ApiProperty({ example: 'def456...', description: 'Token script hash' })
  tokenScriptHash: string;

  @ApiProperty({ example: 100000, description: 'First mint block height' })
  firstMintHeight: number;

  @ApiProperty({ example: 'abcdef0102', description: 'Token metadata in raw hex format' })
  info: string;

  @ApiProperty({ example: '1000', description: 'Token holders num' })
  holdersNum: string;

  @ApiProperty({ example: '124534', description: 'Total Transactions' })
  totalTransNum: string;

  @ApiProperty({ example: '0', description: 'premine' })
  premine: string;

  @ApiProperty({ example: '5', description: 'Token limit' })
  tokenLimit: string;

  @ApiProperty({ example: '21000000', description: 'Token minted' })
  minted: string;

  @ApiProperty({ example: '21000000', description: 'Token supply' })
  supply: string;

  @ApiProperty({ example: 1254, description: 'Deploy block' })
  deployBlock: number;

  @ApiProperty({ example: '45ee725c2c5993b3e4d308842d87e973bf1951f5f7a804b21e4dd964ecd12d6b', description: 'Deploy Txid' })
  deployTxid: string;

  @ApiProperty({ example: '9a3fcb5a8344f53f2ba580f7d488469346bff9efe7780fbbf8d3490e3a3a0cd7', description: 'Reveal Txid' })
  revealTxid: string;

  @ApiProperty({ example: '1760862542', description: 'Deploy Time' })
  deployTime: Date;

  @ApiProperty({ example: 'http://234313.com/logo.png', description: 'Token logo url' })
  logoUrl: string;

}

export class TokenInfoResponse extends BaseResponse<TokenInfo> {
  @ApiProperty({ type: TokenInfo })
  data: TokenInfo;
}

export class TokenUtxo {
  @ApiProperty({ example: 'abc123...', description: 'Transaction ID' })
  txid: string;

  @ApiProperty({ example: 0, description: 'Output index' })
  outputIndex: number;

  @ApiProperty({ example: '456def...', description: 'Locking script' })
  lockingScript: string;

  @ApiProperty({ example: 10000, description: 'Satoshi amount' })
  satoshis: string;

  @ApiProperty({ example: '100', description: 'Token amount' })
  tokenAmount: string;

  @ApiProperty({ example: 100000, description: 'Block height' })
  blockHeight: number;

  @ApiProperty({ example: 'abc123......', description: 'Owner public key hash' })
  ownerPubKeyHash: string;
}

export class TokenUtxosData {
  @ApiProperty({ type: [TokenUtxo], description: 'Token UTXOs' })
  utxos: TokenUtxo[];

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenUtxosResponse extends BaseResponse<TokenUtxosData> {
  @ApiProperty({ type: TokenUtxosData })
  data: TokenUtxosData;
}

export class TokenBalanceData {
  @ApiProperty({ example: '1234567890abcdef_0', description: 'Token ID' })
  tokenId: string;

  @ApiProperty({ example: '100', description: 'Confirmed balance' })
  confirmed: string;

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenBalanceResponse extends BaseResponse<TokenBalanceData> {
  @ApiProperty({ type: TokenBalanceData })
  data: TokenBalanceData;
}

export class TokenMintAmountData {
  @ApiProperty({ example: '5000000000', description: 'Total mint amount' })
  amount: string;

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenMintAmountResponse extends BaseResponse<TokenMintAmountData> {
  @ApiProperty({ type: TokenMintAmountData })
  data: TokenMintAmountData;
}

export class TokenCirculationData {
  @ApiProperty({ example: '4500000000', description: 'Current circulation amount' })
  amount: string;

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenCirculationResponse extends BaseResponse<TokenCirculationData> {
  @ApiProperty({ type: TokenCirculationData })
  data: TokenCirculationData;
}

export class TokenHolder {
  @ApiProperty({ example: 'abc123......', description: 'Owner public key hash' })
  ownerPubKeyHash: string;

  @ApiProperty({ example: '100', description: 'Token balance' })
  balance: string;

  @ApiProperty({ example: 'http://2423113.com/logo.png', description: 'Token logoUrl' })
  logoUrl: string;

  @ApiProperty({ example: '1', description: 'Token rank' })
  rank: string;

  @ApiProperty({ example: '0.05', description: 'Token percentage' })
  percentage: string;

}

export class TokenHoldersData {
  @ApiProperty({ type: [TokenHolder], description: 'Token holders' })
  holders: TokenHolder[];

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class TokenHoldersResponse extends BaseResponse<TokenHoldersData> {
  @ApiProperty({ type: TokenHoldersData })
  data: TokenHoldersData;
}

export class ErrorResponse extends BaseResponse<null> {
  @ApiProperty({ example: 100, description: 'Error code' })
  code: number;

  @ApiProperty({ example: 'Error message', description: 'Error description' })
  msg: string;

  @ApiProperty({ example: null, description: 'Always null for error responses' })
  data: null;
}
