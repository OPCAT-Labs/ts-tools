import { ApiProperty } from '@nestjs/swagger';

export class BaseResponse<T> {
  @ApiProperty({ example: 0, description: 'Response code, 0 for success' })
  code: number;

  @ApiProperty({ example: 'OK', description: 'Response message' })
  msg: string;

  @ApiProperty({ description: 'Response data' })
  data: T;
}

export class MinterUtxo {
  @ApiProperty({ example: 'abc123...', description: 'Transaction ID' })
  txId: string;

  @ApiProperty({ example: 0, description: 'Output index' })
  outputIndex: number;

  @ApiProperty({ example: '456def...', description: 'Locking script' })
  script: string;

  @ApiProperty({ example: 10000, description: 'Satoshi amount' })
  satoshis: number;

  @ApiProperty({ example: 'abc123......', description: 'utxo.data' })
  data: string;
}

export class MinterUtxosData {
  @ApiProperty({ type: [MinterUtxo], description: 'Minter UTXOs' })
  utxos: MinterUtxo[];

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class MinterUtxosResponse extends BaseResponse<MinterUtxosData> {
  @ApiProperty({ type: MinterUtxosData })
  data: MinterUtxosData;
}

export class MinterUtxoCountData {
  @ApiProperty({ example: 42, description: 'Total count of minter UTXOs' })
  count: number;

  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;
}

export class MinterUtxoCountResponse extends BaseResponse<MinterUtxoCountData> {
  @ApiProperty({ type: MinterUtxoCountData })
  data: MinterUtxoCountData;
}

export class ErrorResponse extends BaseResponse<null> {
  @ApiProperty({ example: 100, description: 'Error code' })
  code: number;

  @ApiProperty({ example: 'Error message', description: 'Error description' })
  msg: string;

  @ApiProperty({ example: null, description: 'Always null for error responses' })
  data: null;
}
