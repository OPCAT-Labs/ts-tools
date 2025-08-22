import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiBadRequestResponse, ApiHeader } from '@nestjs/swagger';
import { errorResponse, okResponse } from '../../common/utils';
import { CommonService } from '../../services/common/common.service';
import { ResponseHeaderInterceptor } from '../../common/interceptors/response-header.interceptor';
import {
  HealthCheckResponse,
  ErrorResponse,
} from './dto/health-check-response.dto';

@Controller()
@UseInterceptors(ResponseHeaderInterceptor)
export class HealthCheckController {
  constructor(private readonly commonService: CommonService) {}

  @Get()
  @ApiTags('info')
  @ApiOperation({ summary: 'Check the health of the service' })
  @ApiOkResponse({
    description: 'Service health status retrieved successfully',
    type: HealthCheckResponse,
  })
  @ApiBadRequestResponse({
    description: 'Failed to retrieve service health status',
    type: ErrorResponse,
  })
  async checkHealth() {
    try {
      const blockchainInfo = await this.commonService.getBlockchainInfo();
      return okResponse({
        trackerBlockHeight: await this.commonService.getLastProcessedBlockHeight(),
        nodeBlockHeight: blockchainInfo?.blocks || null,
        latestBlockHeight: blockchainInfo?.headers || null,
      });
    } catch (e) {
      return errorResponse(e);
    }
  }
}
