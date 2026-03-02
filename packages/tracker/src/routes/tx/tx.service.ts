import { HttpException, Injectable, Logger } from '@nestjs/common';
import { TokenService } from '../token/token.service';
import { TxOutEntity } from '../../entities/txOut.entity';
import { TxOutArchiveEntity } from '../../entities/txOutArchive.entity';
import { TokenInfoEntity } from '../../entities/tokenInfo.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CachedContent, TokenTypeScope } from '../../common/types';
import { CommonService } from '../../services/common/common.service';
import { Constants } from '../../common/constants';
import { ownerAddressToPubKeyHash, } from '../../common/utils';
import { LRUCache } from 'lru-cache';
import { HttpStatusCode } from 'axios';
import { Transaction } from '@opcat-labs/opcat';
import { toHex } from '@opcat-labs/scrypt-ts-opcat';
import { MetadataSerializer, ContractPeripheral } from '@opcat-labs/cat-sdk';



@Injectable()
export class TxService {
  private readonly logger = new Logger(TxService.name);

  private static readonly contentCache = new LRUCache<string, CachedContent>({
    max: Constants.CACHE_MAX_SIZE,
  });

  // Cache for queryTransactionsByAddress results
  // Key format: "addr:{ownerPubKeyHash}:offset:{offset}:limit:{limit}"
  // TTL: 5 minutes (addresses with new transactions will get stale cache, but acceptable tradeoff)
  private static readonly addressTxCache = new LRUCache<string, { total: number; list: string[] }>({
    max: 5000, // Cache up to 5000 different queries
    ttl: 1000 * 60 * 5, // 5 minutes TTL
  });

  constructor(
    private readonly commonService: CommonService,
    private readonly tokenService: TokenService,

    @InjectRepository(TxOutEntity)
    private readonly txOutRepository: Repository<TxOutEntity>,

    @InjectRepository(TxOutArchiveEntity)
    private readonly txOutArchiveRepository: Repository<TxOutArchiveEntity>,

    @InjectRepository(TokenInfoEntity)
    private readonly tokenInfoRepository: Repository<TokenInfoEntity>,

  ) { }

  /**
   * @param txid
   * @returns
   */
  async parseTransferTxTokenOutputs(txid: string) {
    const raw = await this.commonService.getRawTx(txid);
    const tx = new Transaction(raw);
    await this.commonService.txAddPrevouts(tx);
    const guardInputs = this.commonService.searchGuardInputs(tx.inputs);
    if (guardInputs.length === 0) {
      throw new Error('not a token transfer tx');
    }
    const outputs = [];
    for (const guardInput of guardInputs) {
      const isFungible = this.commonService.isFungibleGuard(guardInput);

      if (isFungible) {
        const tokenOutputs = this.commonService.parseTransferTxCAT20Outputs(guardInput);
        outputs.push(
          ...(await Promise.all(
            [...tokenOutputs.keys()].map(async (i) => {
              const outputScript = tx.outputs[i].script.toHex();
              const tokenInfo = await this.tokenService.getTokenInfoByTokenIdOrTokenScriptHash(
                ContractPeripheral.scriptHash(outputScript),
                TokenTypeScope.Fungible,
              );
              const tokenOutput = tokenOutputs.get(i);
              return Object.assign(
                {
                  outputIndex: i,
                  ownerPubKeyHash: tokenOutput.ownerPubKeyHash,
                  tokenAmount: tokenOutput.tokenAmount.toString(),
                  tokenId: tokenInfo.tokenId,
                },
              );
            }),
          )),
        );
      } else {
        const tokenOutputs = this.commonService.parseTransferTxCAT721Outputs(guardInput);
        outputs.push(
          ...(await Promise.all(
            [...tokenOutputs.keys()].map(async (i) => {
              const outputScript = tx.outputs[i].script.toHex();
              const tokenInfo = await this.tokenService.getTokenInfoByTokenIdOrTokenScriptHash(
                ContractPeripheral.scriptHash(outputScript),
                TokenTypeScope.NonFungible,
              );
              const tokenOutput = tokenOutputs.get(i);
              return Object.assign(
                {
                  outputIndex: i,
                  ownerPubKeyHash: tokenOutput.ownerPubKeyHash,
                  localId: tokenOutput.localId.toString(),
                  collectionId: tokenInfo.tokenId,
                },
              );
            }),
          )),
        );
      }
    }
    return { outputs };
  }


  /**
   * Decode delegate, note: unlike the ordinals spec, the delegate info is not stored in the witness, but stored in the tx output.data
   * @param delegate 
   * @returns 
   */
  decodeDelegate(delegate: Buffer): { txId: string; outputIndex: number } | undefined {
    try {
      const buf = Buffer.concat([delegate, Buffer.from([0x00, 0x00, 0x00, 0x00])]);
      const txId = buf.subarray(0, 32).reverse().toString('hex');
      const outputIndex = buf.subarray(32, 36).readUInt32LE();
      return { txId, outputIndex };
    } catch (e) {
      this.logger.error(`decode delegate error: ${e.message}`);
    }
    return undefined;
  }

  public async getDelegateContent(delegate: string): Promise<CachedContent | null> {
    const { txId, outputIndex } = this.decodeDelegate(Buffer.from(delegate, 'hex')) || {};
    const key = `${txId}_${outputIndex}`;
    let cached = TxService.contentCache.get(key);
    if (!cached) {
      const raw = await this.commonService.getRawTx(txId);
      const tx = new Transaction(raw);
      if (outputIndex < tx.outputs.length) {
        const content = await this.parseContentEnvelope(toHex(tx.outputs[outputIndex].data));
        if (content) {
          cached = content;
          if (Number(raw['confirmations']) >= Constants.CACHE_AFTER_N_BLOCKS) {
            TxService.contentCache.set(key, cached);
          }
        }
      }
    }
    return cached;
  }

  async parseContentEnvelope(data: string): Promise<CachedContent | null> {
    try {
      const info = MetadataSerializer.deserialize(data);
      const isDelegate = info?.info.delegate?.length > 0 && !info?.info.contentBody;
      if (isDelegate) {
        return this.getDelegateContent(info.info.delegate)
      }
      return {
        type: MetadataSerializer.decodeContentType(info?.info.contentType),
        encoding: info?.info.contentEncoding,
        raw: Buffer.from(info?.info.contentBody, 'hex'),
      }
    } catch (e) {
      this.logger.error(`parse content envelope error, ${e.message}`);
    }
    return null;
  }

  /**
   * Query total number of unique transactions by address.
   * Queries both tx_out and tx_out_archive tables and deduplicates by txid.
   * Filters by token type scope using decimals field from token_info table.
   *
   * @param ownerPubKeyHash - Owner public key hash
   * @param scope - Token type scope (Fungible for CAT-20, NonFungible for CAT-721)
   * @returns Total count of unique transaction IDs
   */
  private async queryTotalTxsByAddress(
    ownerPubKeyHash: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
  ): Promise<number> {
    const decimalsCondition = scope === TokenTypeScope.Fungible
      ? '>= 0'
      : '< 0';

    // Query both tx_out and tx_out_archive with JOIN to token_info
    // UNION automatically deduplicates txids
    const query = `
      SELECT COUNT(DISTINCT txid) as count
      FROM (
        SELECT DISTINCT tx_out.txid
        FROM tx_out
        INNER JOIN token_info ON tx_out.locking_script_hash = token_info.token_script_hash
        WHERE tx_out.owner_pkh = $1
          AND token_info.decimals ${decimalsCondition}
        UNION
        SELECT DISTINCT tx_out_archive.txid
        FROM tx_out_archive
        INNER JOIN token_info ON tx_out_archive.locking_script_hash = token_info.token_script_hash
        WHERE tx_out_archive.owner_pkh = $1
          AND token_info.decimals ${decimalsCondition}
      ) as combined
    `;

    const result = await this.txOutRepository.query(query, [ownerPubKeyHash]);
    return Number(result[0]?.count || '0');
  }

  /**
   * Query paginated list of unique transactions by address.
   * Queries both tx_out and tx_out_archive tables and deduplicates by txid.
   * Filters by token type scope using decimals field from token_info table.
   *
   * @param ownerPubKeyHash - Owner public key hash
   * @param scope - Token type scope (Fungible for CAT-20, NonFungible for CAT-721)
   * @param offset - Pagination offset
   * @param limit - Pagination limit
   * @returns Array of unique transaction IDs
   */
  private async queryTxsByAddress(
    ownerPubKeyHash: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
    offset: number,
    limit: number
  ): Promise<string[]> {
    const decimalsCondition = scope === TokenTypeScope.Fungible
      ? '>= 0'
      : '< 0';

    // Query both tx_out and tx_out_archive with JOIN to token_info
    // UNION automatically deduplicates txids
    // ORDER BY txid for consistent pagination
    const query = `
      SELECT DISTINCT txid
      FROM (
        SELECT DISTINCT tx_out.txid
        FROM tx_out
        INNER JOIN token_info ON tx_out.locking_script_hash = token_info.token_script_hash
        WHERE tx_out.owner_pkh = $1
          AND token_info.decimals ${decimalsCondition}
        UNION
        SELECT DISTINCT tx_out_archive.txid
        FROM tx_out_archive
        INNER JOIN token_info ON tx_out_archive.locking_script_hash = token_info.token_script_hash
        WHERE tx_out_archive.owner_pkh = $1
          AND token_info.decimals ${decimalsCondition}
      ) as combined
      ORDER BY txid DESC
      OFFSET $2
      LIMIT $3
    `;

    const result = await this.txOutRepository.query(query, [
      ownerPubKeyHash,
      offset,
      limit
    ]);
    return result.map((row: { txid: string }) => row.txid);
  }

  async getTransactionsByAddress(
    ownerAddrOrPkh: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
    offset: number,
    limit: number
  ) {
    const ownerPubKeyHash = ownerAddressToPubKeyHash(ownerAddrOrPkh);
    if (!ownerPubKeyHash) {
      throw new HttpException('Invalid ownerAddrOrPkh', HttpStatusCode.BadRequest);
    }

    // Generate cache key including scope
    const cacheKey = `addr:${ownerPubKeyHash}:scope:${scope}:offset:${offset}:limit:${limit}`;

    // Check cache first
    const cached = TxService.addressTxCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get total count using the new function
    const total = await this.queryTotalTxsByAddress(ownerPubKeyHash, scope);
    // Get paginated transaction list using the new function
    const list = await this.queryTxsByAddress(ownerPubKeyHash, scope, offset, limit);

    const result = {
      total,
      list
    };

    // Store in cache
    TxService.addressTxCache.set(cacheKey, result);
    this.logger.debug(`Cache miss, stored ${cacheKey}`);

    return result;

  }

}
