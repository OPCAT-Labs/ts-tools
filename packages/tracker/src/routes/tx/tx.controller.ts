import { Controller, Get, Param , Res, UseInterceptors } from '@nestjs/common';
import { TxService } from './tx.service';
import { ApiOperation, ApiParam, ApiTags, ApiOkResponse, ApiBadRequestResponse, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { errorResponse, okResponse } from '../../common/utils';
import { Response } from 'express';
import { ResponseHeaderInterceptor } from '../../common/interceptors/response-header.interceptor';
import {
  TxTokenOutputsResponse,
  ErrorResponse,
} from './dto/tx-response.dto';

@Controller('tx')
@UseInterceptors(ResponseHeaderInterceptor)
export class TxController {
  constructor(private readonly txService: TxService) { }

  @Get(':txid')
  @ApiTags('tx')
  @ApiOperation({ summary: 'Get tx token outputs by txid' })
  @ApiParam({
    name: 'txid',
    required: true,
    type: String,
    description: 'txid',
  })
  @ApiOkResponse({
    description: 'Transaction token outputs retrieved successfully',
    type: TxTokenOutputsResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid transaction ID or not a token transfer transaction',
    type: ErrorResponse,
  })
  async parseTransferTxTokenOutputs(@Param('txid') txid: string) {
    try {
      const parsedTx = await this.txService.parseTransferTxTokenOutputs(txid);
      return okResponse(parsedTx);
    } catch (e) {
      return errorResponse(e);
    }
  }

  @Get(':txid/content/:inputIndex')
  @ApiTags('tx')
  @ApiOperation({ summary: 'Get content from a specific tx input' })
  @ApiParam({
    name: 'txid',
    required: true,
    type: String,
    description: 'txid',
  })
  @ApiParam({
    name: 'inputIndex',
    required: true,
    type: 'integer',
    description: 'input index',
  })
  @ApiResponse({
    status: 200,
    description: 'Content retrieved successfully',
    content: {
      '*/*': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
    headers: {
      'Content-Type': {
        description: 'MIME type of the content',
        schema: {
          type: 'string',
        },
      },
      'Content-Encoding': {
        description: 'Content encoding if applicable',
        schema: {
          type: 'string',
        },
      },
      'Last-Modified': {
        description: 'Last modification date',
        schema: {
          type: 'string',
        },
      },
      'Cache-Control': {
        description: 'Cache control directives',
        schema: {
          type: 'string',
          example: 'public, max-age=31536000',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Content not found',
  })
  @ApiBadRequestResponse({
    description: 'Invalid transaction ID or input index',
    type: ErrorResponse,
  })
  async parseDelegateContent(
    @Param('txid') txid: string,
    @Param('inputIndex') inputIndex: number,
    @Res() res: Response,
  ) {
    try {
      const inputIndexBuf = Buffer.alloc(4);
      inputIndexBuf.writeUInt32LE(inputIndex || 0);
      const delegate = Buffer.concat([Buffer.from(txid, 'hex').reverse(), inputIndexBuf]);
      const content = await this.txService.getDelegateContent(delegate);
      if (content?.raw) {
        if (content?.type) {
          res.setHeader('Content-Type', content.type);
        }
        if (content?.encoding) {
          res.setHeader('Content-Encoding', content.encoding);
        }
        if (content?.lastModified) {
          res.setHeader('Last-Modified', content.lastModified.toUTCString());
        }
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(content.raw);
      } else {
        res.sendStatus(404);
      }
    } catch (e) {
      return res.send(errorResponse(e));
    }
  }

}