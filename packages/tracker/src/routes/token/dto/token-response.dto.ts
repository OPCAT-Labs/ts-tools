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
