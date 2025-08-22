import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { MinterService } from './minter.service';
import { errorResponse, okResponse } from '../../common/utils';
import { ApiOperation, ApiParam, ApiQuery, ApiTags, ApiOkResponse, ApiBadRequestResponse, ApiHeader } from '@nestjs/swagger';
import { ResponseHeaderInterceptor } from '../../common/interceptors/response-header.interceptor';
import {
  MinterUtxosResponse,
  MinterUtxoCountResponse,
  ErrorResponse,
} from './dto/minter-response.dto';

@Controller('minters')
@UseInterceptors(ResponseHeaderInterceptor)
export class MinterController {
  constructor(private readonly minterService: MinterService) {}

  @Get(':tokenIdOrTokenScriptHash/utxos')
  @ApiTags('minter')
  @ApiOperation({ summary: 'Get minter utxos by token id or token address' })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token address',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'paging offset',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'paging limit',
  })
  @ApiOkResponse({
    description: 'Minter UTXOs retrieved successfully',
    type: MinterUtxosResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token address',
    type: ErrorResponse,
  })
  async getMinterUtxos(
    @Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      const utxos = await this.minterService.getMinterUtxos(tokenIdOrTokenScriptHash, offset, limit);
      return okResponse(utxos);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':tokenIdOrTokenScriptHash/utxoCount')
  @ApiTags('minter')
  @ApiOperation({
    summary: 'Get minter utxo count by token id or token address',
  })
  @ApiParam({
    name: 'tokenIdOrTokenScriptHash',
    required: true,
    type: String,
    description: 'token id or token address',
  })
  @ApiOkResponse({
    description: 'Minter UTXO count retrieved successfully',
    type: MinterUtxoCountResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token id or token address',
    type: ErrorResponse,
  })
  async getMinterUtxoCount(@Param('tokenIdOrTokenScriptHash') tokenIdOrTokenScriptHash: string) {
    try {
      const utxos = await this.minterService.getMinterUtxoCount(tokenIdOrTokenScriptHash);
      return okResponse(utxos);
    } catch (e) {
      return errorResponse(e);
    }
  }
}
