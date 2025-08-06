import { ApiProperty } from '@nestjs/swagger';

export class BaseResponse<T> {
  @ApiProperty({ example: 0, description: 'Response code, 0 for success' })
  code: number;

  @ApiProperty({ example: 'OK', description: 'Response message' })
  msg: string;

  @ApiProperty({ description: 'Response data' })
  data: T;
}

export class HealthCheckData {
  @ApiProperty({ example: 100000, description: 'Current tracker block height' })
  trackerBlockHeight: number;

  @ApiProperty({ example: 100005, description: 'Node block height', nullable: true })
  nodeBlockHeight: number | null;

  @ApiProperty({ example: 100010, description: 'Latest block height', nullable: true })
  latestBlockHeight: number | null;
}

export class HealthCheckResponse extends BaseResponse<HealthCheckData> {
  @ApiProperty({ type: HealthCheckData })
  data: HealthCheckData;
}

export class ErrorResponse extends BaseResponse<null> {
  @ApiProperty({ example: 100, description: 'Error code' })
  code: number;

  @ApiProperty({ example: 'Error message', description: 'Error description' })
  msg: string;

  @ApiProperty({ example: null, description: 'Always null for error responses' })
  data: null;
}
