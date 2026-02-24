import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TokenInfoEntity } from '../../entities/tokenInfo.entity';
import { IsNull, LessThanOrEqual, Repository, MoreThanOrEqual, LessThan, Like, ILike, FindOptionsWhere, Not } from 'typeorm';
import { ownerAddressToPubKeyHash, parseBlockchainIdentifier, pubKeyHashToOwnerAddress } from '../../common/utils';
import { TxOutEntity } from '../../entities/txOut.entity';
import { TxOutArchiveEntity } from '../../entities/txOutArchive.entity';
import { Constants } from '../../common/constants';
import { LRUCache } from 'lru-cache';
import { TxEntity } from '../../entities/tx.entity';
import { CommonService } from '../../services/common/common.service';
import { CachedContent, TokenTypeScope } from '../../common/types';
import { TokenMintEntity } from '../../entities/tokenMint.entity';
import { HttpStatusCode } from 'axios';
import { MetadataSerializer } from '@opcat-labs/cat-sdk';
import { Decimal } from 'decimal.js';
import { SupportedNetwork } from '@opcat-labs/scrypt-ts-opcat';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TokenService {
  // tx stateHashes and txHashPreimage cache
  private static readonly txCache = new LRUCache<string, TxEntity>({
    max: Constants.CACHE_MAX_SIZE,
  });

  // Token info cache without TTL (permanent until LRU eviction)
  // Only caches token info when tokenScriptHash exists (see line 121)
  // This ensures incomplete token info is not cached
  private static readonly tokenInfoCache = new LRUCache<string, TokenInfoEntity>({
    max: Constants.CACHE_MAX_SIZE,
  });

  private static readonly holdersCache = new LRUCache<string, {
    holders: {
      address: string;
      balance: string;
      percentage: number;
      rank: number
    }[];
    total: number;
    trackerBlockHeight: number;
  }>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  });

  private static readonly totalHoldersCache = new LRUCache<string, {
    totalHolders: number;
    trackerBlockHeight: number;
  }>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  });

  private static readonly totalTxsCache = new LRUCache<string, {
    totalTxs: number;
    trackerBlockHeight: number;
  }>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  });
  private static readonly txsCache = new LRUCache<string, {
    total: number;
    txs: string[];
    trackerBlockHeight: number;
  }>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  })

  private static readonly mintedAmountCache = new LRUCache<string, any>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  });

  private static readonly tokenIconCache = new LRUCache<string, CachedContent | null>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 60 * 60 * 1000, // 1 hour
  });

  private static readonly searchTokensCache = new LRUCache<string, any>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 30 * 1000, // 30 seconds cache to prevent DOS attacks
    ttlAutopurge: true
  });

  private static readonly totalSupplyCache = new LRUCache<string, {
    totalSupply: string;
    trackerBlockHeight: number;
  }>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  });

  private network!: SupportedNetwork

  constructor(
    private readonly commonService: CommonService,
    @InjectRepository(TokenInfoEntity)
    private readonly tokenInfoRepository: Repository<TokenInfoEntity>,
    @InjectRepository(TxOutEntity)
    private readonly txOutRepository: Repository<TxOutEntity>,
    @InjectRepository(TxOutArchiveEntity)
    private readonly txOutArchiveRepository: Repository<TxOutArchiveEntity>,
    @InjectRepository(TxEntity)
    private readonly txRepository: Repository<TxEntity>,
    @InjectRepository(TokenMintEntity)
    private readonly tokenMintRepository: Repository<TokenMintEntity>,
    private readonly configService: ConfigService,
  ) { 
    this.network = this.configService.get('NETWORK') as SupportedNetwork;
  }

  async getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash: string, scope: TokenTypeScope) {
    let cached = TokenService.tokenInfoCache.get(tokenIdOrTokenScriptHash);
    if (!cached) {
      let where: object;
      if (tokenIdOrTokenScriptHash.includes('_')) {
        where = { tokenId: tokenIdOrTokenScriptHash };
      } else {
        where = { tokenScriptHash: tokenIdOrTokenScriptHash };
      }
      if (scope === TokenTypeScope.Fungible) {
        where = Object.assign(where, { decimals: MoreThanOrEqual(0) });
      } else if (scope === TokenTypeScope.NonFungible) {
        where = Object.assign(where, { decimals: LessThan(0) });
      }
      const tokenInfo = await this.tokenInfoRepository.findOne({
        select: [
          'tokenId',
          'genesisTxid',
          'name',
          'symbol',
          'decimals',
          'hasAdmin',
          'rawInfo',
          'minterScriptHash',
          'adminScriptHash',
          'tokenScriptHash',
          'firstMintHeight',
          'deployHeight',
          'deployTxid',
        ],
        where,
      });
      if (tokenInfo && tokenInfo.tokenScriptHash) {
        const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
        if (lastProcessedHeight !== null) {
          TokenService.tokenInfoCache.set(tokenIdOrTokenScriptHash, tokenInfo);
        }
      }
      cached = tokenInfo;
    } else {
      if (cached.decimals < 0 && scope === TokenTypeScope.Fungible) {
        cached = null;
      } else if (cached.decimals >= 0 && scope === TokenTypeScope.NonFungible) {
        cached = null;
      }
    }
    return this.renderTokenInfo(cached);
  }

  async searchTokens(
    query: string | undefined,
    scope: TokenTypeScope,
    offset: number | null = null,
    limit: number | null = null,
  ): Promise<{
    tokens: any[];
    total: number;
    trackerBlockHeight: number;
  }> {
    const finalOffset = offset || 0;
    const finalLimit = Math.min(limit || Constants.QUERY_PAGING_DEFAULT_LIMIT, Constants.QUERY_PAGING_MAX_LIMIT);
    const cacheKey = `search-tokens-${query || 'all'}-${scope}-${finalOffset}-${finalLimit}`;

    const cached = TokenService.searchTokensCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    query = query ? query.trim() : query;

    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const blockIdentifierDetection = parseBlockchainIdentifier(query || '');

    try {
      // Build base condition for scope filtering
      const baseCondition: FindOptionsWhere<TokenInfoEntity> = {
        tokenScriptHash: Not(IsNull()), // Always filter for tokens with valid tokenScriptHash
      };
      if (scope === TokenTypeScope.Fungible) {
        baseCondition.decimals = MoreThanOrEqual(0);
      } else if (scope === TokenTypeScope.NonFungible) {
        baseCondition.decimals = LessThan(0);
      }

      // Build where condition (always use array for consistent type)
      let whereCondition: FindOptionsWhere<TokenInfoEntity>[];
      if (query) {
        // If query exists, search in tokenId, name, or symbol (OR logic)
        whereCondition = [
          { ...baseCondition, tokenId: query },
          { ...baseCondition, name: ILike(`%${query}%`) },
          { ...baseCondition, symbol: ILike(`%${query}%`) }
        ];
        if (blockIdentifierDetection.isSha256Hash) {
          whereCondition.push({ ...baseCondition, tokenScriptHash: query });
        }
        if (blockIdentifierDetection.isOutpoint) {
          whereCondition.push({ ...baseCondition, genesisTxid: blockIdentifierDetection.outpoint.txid });
        }
      } else {
        // If no query, wrap base condition in array for consistent type
        whereCondition = [baseCondition];
      }

      const [tokens, total] = await this.tokenInfoRepository.findAndCount({
        select: [
          'tokenId',
          'genesisTxid',
          'name',
          'symbol',
          'decimals',
          'minterScriptHash',
          'tokenScriptHash',
          'firstMintHeight',
          'rawInfo',
          'deployHeight',
          'deployTxid',
        ],
        where: whereCondition,
        skip: finalOffset,
        take: finalLimit,
        order: {
          updatedAt: 'DESC'
        }
      });

      const result = {
        tokens: tokens.map(token => this.renderTokenInfo(token)),
        total: total,
        trackerBlockHeight: lastProcessedHeight
      };

      // Cache the result to prevent DOS attacks
      TokenService.searchTokensCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error in searchTokens:', error);
      return {
        tokens: [],
        total: 0,
        trackerBlockHeight: lastProcessedHeight
      };
    }
  }


  /**
   * Query the total number of unique transactions for a token.
   * Queries both tx_out and tx_out_archive tables and deduplicates by txid.
   *
   * @param tokenScriptHash - Token script hash to query
   * @returns Total count of unique transaction IDs
   */
  private async queryTxCount(tokenScriptHash: string): Promise<number> {
    // Query both tx_out and tx_out_archive, then count distinct txids
    const query = `
      SELECT COUNT(DISTINCT txid) as count
      FROM (
        SELECT txid FROM tx_out WHERE locking_script_hash = $1
        UNION
        SELECT txid FROM tx_out_archive WHERE locking_script_hash = $1
      ) as combined
    `;

    const result = await this.txOutRepository.query(query, [tokenScriptHash]);
    return Number(result[0]?.count || '0');
  }

  private async getTokenTxsByTokenScriptHash(
    tokenScriptHash: string,
    offset: number,
    limit: number,
  ): Promise<string[]> {
    // Query both tx_out and tx_out_archive, then union and deduplicate txids
    // order by block height desc, txindex desc if same block height, created_at if same txindex
    // Note: UNION automatically deduplicates, so we don't need DISTINCT

    const query = `
      SELECT combined.txid
      FROM (
        SELECT txo.txid, tx.block_height, tx.tx_index, txo.created_at
        FROM tx_out txo
        INNER JOIN tx ON txo.txid = tx.txid
        WHERE txo.locking_script_hash = $1
        UNION
        SELECT txoa.txid, tx.block_height, tx.tx_index, txoa.created_at
        FROM tx_out_archive txoa
        INNER JOIN tx ON txoa.txid = tx.txid
        WHERE txoa.locking_script_hash = $1
      ) as combined
      ORDER BY combined.block_height DESC, combined.tx_index DESC, combined.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.txOutRepository.query(query, [tokenScriptHash, limit, offset]);
    return result.map((row: { txid: string }) => row.txid);
  }

  async getTokenTxsByTokenIdOrTokenScriptHash(
    tokenIdOrTokenScriptHash: string,
    scope: TokenTypeScope,
    offset: number,
    limit: number,
  ): Promise<{total: number, txs: string[], trackerBlockHeight: number}> {
    let txsKey = `txs-${tokenIdOrTokenScriptHash}-${scope}-${offset}-${limit}`;
    let cache = TokenService.txsCache.get(txsKey);
    if (cache !== null && cache !== undefined) {
      return cache;
    }
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash, scope);
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    if (!tokenInfo?.tokenScriptHash || lastProcessedHeight === null) {
      return {
        total: 0,
        txs: [],
        trackerBlockHeight: lastProcessedHeight,
      }
    }
    const total = await this.queryTxCount(tokenInfo.tokenScriptHash);
    const txs = await this.getTokenTxsByTokenScriptHash(tokenInfo.tokenScriptHash, offset, limit);
    cache = { total, txs, trackerBlockHeight: lastProcessedHeight  };
    TokenService.txsCache.set(txsKey, cache);
    return cache;
  }

  async getTokenTotalTxsByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash: string, scope: TokenTypeScope) {
    const totalTxsKey = `totalTxs-${tokenIdOrTokenScriptHash}-${scope}`;
    let cache = TokenService.totalTxsCache.get(totalTxsKey);
    if (cache !== null && cache !== undefined) {
      return cache;
    }

    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash, scope);
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    if (!tokenInfo?.tokenScriptHash || lastProcessedHeight === null) {
      return {
        totalTxs: 0,
        trackerBlockHeight: lastProcessedHeight,
      };
    }

    const totalTxs = await this.queryTxCount(tokenInfo.tokenScriptHash);
    cache = { totalTxs, trackerBlockHeight: lastProcessedHeight };

    TokenService.totalTxsCache.set(totalTxsKey, cache);
    return cache
  }

  renderTokenInfo(tokenInfo: TokenInfoEntity) {
    if (!tokenInfo) {
      return null;
    }
    const rendered = Object.assign({}, { info: tokenInfo.rawInfo }, tokenInfo);
    delete rendered.rawInfo;
    return rendered;
  }

  async getTokenUtxosByOwnerAddress(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope,
    ownerAddrOrPkh: string,
    offset?: number,
    limit?: number,
  ) {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    let utxos = [];
    if (tokenInfo?.tokenScriptHash) {
      utxos = await this.queryTokenUtxosByOwnerAddress(
        lastProcessedHeight,
        ownerAddrOrPkh,
        tokenInfo,
        offset || Constants.QUERY_PAGING_DEFAULT_OFFSET,
        Math.min(limit || Constants.QUERY_PAGING_DEFAULT_LIMIT, Constants.QUERY_PAGING_MAX_LIMIT),
      );
    }
    return {
      utxos: await this.renderUtxos(utxos, tokenInfo),
      trackerBlockHeight: lastProcessedHeight,
    };
  }

  async getTokenAmountsByOwnerAddress(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope,
    ownerAddrOrPkh: string,
  ) {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    let amounts: TxOutEntity[] = [];
    if (tokenInfo) {
      amounts = await this.queryTokenAmountsByOwnerAddress(lastProcessedHeight, ownerAddrOrPkh, tokenInfo);
    }
    return {
      trackerBlockHeight: lastProcessedHeight,
      amounts: amounts.map((amount) => amount.tokenAmount.toString()),
    }
  }

  async getTokenBalanceByOwnerAddress(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
    ownerAddrOrPkh: string,
  ) {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    if (!tokenInfo) {
      throw new HttpException('Invalid tokenIdOrTokenAddr', HttpStatusCode.BadRequest);
    }
    const balances = await this.queryTokenBalancesByOwnerAddress(lastProcessedHeight, ownerAddrOrPkh, scope, tokenInfo);
    return {
      tokenId: tokenInfo.tokenId,
      confirmed: balances.length === 1 ? balances[0].confirmed.toString() : '0',
      trackerBlockHeight: lastProcessedHeight,
    };
  }

  async queryTokenUtxosByOwnerAddress(
    lastProcessedHeight: number,
    ownerAddrOrPkh: string,
    tokenInfo: TokenInfoEntity | null = null,
    offset: number | null = null,
    limit: number | null = null,
  ) {
    const ownerPubKeyHash = ownerAddressToPubKeyHash(ownerAddrOrPkh);
    if (lastProcessedHeight === null || (tokenInfo && !tokenInfo.tokenScriptHash) || !ownerPubKeyHash) {
      return [];
    }
    const where = {
      ownerPubKeyHash,
      spendTxid: IsNull(),
    };
    if (tokenInfo) {
      Object.assign(where, { lockingScriptHash: tokenInfo.tokenScriptHash });
    }
    return this.txOutRepository.find({
      where,
      order: { tokenAmount: 'DESC' },
      skip: offset,
      take: limit,
    });
  }

  async queryTokenAmountsByOwnerAddress(
    lastProcessedHeight: number,
    ownerAddrOrPkh: string,
    tokenInfo: TokenInfoEntity,
  ) {
    const ownerPubKeyHash = ownerAddressToPubKeyHash(ownerAddrOrPkh);
    if (lastProcessedHeight === null || (tokenInfo && !tokenInfo.tokenScriptHash) || !ownerPubKeyHash) {
      return [];
    }
    const where = {
      ownerPubKeyHash,
      spendTxid: IsNull(),
      lockingScriptHash: tokenInfo.tokenScriptHash,
    };
    return this.txOutRepository.find({
      select: ['tokenAmount'],
      where,
    });
  }


  async queryTokenBalancesByOwnerAddress(
    lastProcessedHeight: number,
    ownerAddrOrPkh: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
    tokenInfo: TokenInfoEntity | null = null,
  ) {
    const ownerPubKeyHash = ownerAddressToPubKeyHash(ownerAddrOrPkh);
    if (!ownerPubKeyHash) {
      throw new HttpException('Invalid ownerAddrOrPkh', HttpStatusCode.BadRequest);
    }
    if (lastProcessedHeight === null || (tokenInfo && !tokenInfo.tokenScriptHash) || !ownerPubKeyHash) {
      return [];
    }
    const query = this.txOutRepository
      .createQueryBuilder('t1')
      .select('t2.token_id', 'tokenId')
      .addSelect('t2.tokenScriptHash', 'tokenScriptHash')
      .addSelect('t2.name', 'name')
      .addSelect('t2.symbol', 'symbol')
      .addSelect('t2.decimals', 'decimals')
      .innerJoin(TokenInfoEntity, 't2', 't1.locking_script_hash = t2.token_script_hash')
      .where('t1.spend_txid IS NULL')
      .andWhere('t1.owner_pkh = :ownerPkh', { ownerPkh: ownerPubKeyHash })
      .groupBy('t2.token_id');
    if (scope === TokenTypeScope.Fungible) {
      query.addSelect('SUM(t1.token_amount)', 'confirmed').andWhere('t2.decimals >= 0');
    } else {
      query.addSelect('COUNT(1)', 'confirmed').andWhere('t2.decimals < 0');
    }
    if (tokenInfo) {
      query.andWhere('t1.locking_script_hash = :tokenPubKey', {
        tokenPubKey: tokenInfo.tokenScriptHash,
      });
    }
    const results = await query.getRawMany();

    return results.map((r) => ({
      tokenId: r.tokenId,
      confirmed: r.confirmed,
      tokenScriptHash: r.tokenScriptHash,
      name: r.name,
      symbol: r.symbol,
      decimals: r.decimals,
    }));
  }

  /**
   * render token utxos when passing tokenInfo, otherwise render minter utxos
   */
  async renderUtxos(utxos: TxOutEntity[], tokenInfo?: TokenInfoEntity) {
    const renderedUtxos = [];
    for (const utxo of utxos) {
      const renderedUtxo = {
        txId: utxo.txid,
        outputIndex: utxo.outputIndex,
        script: utxo.lockingScriptHash,
        satoshis: Number(utxo.satoshis),
        data: utxo.data,
      };
      if (utxo.ownerPubKeyHash !== null && utxo.tokenAmount !== null) {
        Object.assign(
          renderedUtxo,
          tokenInfo && tokenInfo.decimals >= 0
            ? {
              state: {
                address: utxo.ownerPubKeyHash,
                amount: utxo.tokenAmount,
              },
            }
            : {
              state: {
                address: utxo.ownerPubKeyHash,
                localId: utxo.tokenAmount,
              },
            },
        );
      }
      renderedUtxos.push(renderedUtxo);
    }
    return renderedUtxos;
  }

  async getTokenTotalMintedAmount(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
  ): Promise<{
    amount: string;
    trackerBlockHeight: number;
  }> {

    const mintedAmountKey = `mintedAmount-${tokenIdOrTokenAddr}-${scope}`;
    let cache = TokenService.mintedAmountCache.get(mintedAmountKey);

    if (cache !== null && cache !== undefined) {
      return cache;
    }

    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    if (!tokenInfo?.tokenScriptHash || lastProcessedHeight === null) {
      return {
        amount: '0',
        trackerBlockHeight: lastProcessedHeight,
      };
    }

    const where = {
      tokenScriptHash: tokenInfo.tokenScriptHash,
    };
    let amount: string;
    if (scope === TokenTypeScope.Fungible) {
      const r = await this.tokenMintRepository
        .createQueryBuilder()
        .select('SUM(token_amount)', 'count')
        .where(where)
        .getRawOne();
      amount = r?.count || '0';
    } else {
      const r = await this.tokenMintRepository.count({ where });
      amount = (r || 0).toString();
    }
    
    cache = {
      amount,
      trackerBlockHeight: lastProcessedHeight,
    };
    TokenService.mintedAmountCache.set(mintedAmountKey, cache);

    return cache;
  }

  /**
   * Get token total supply with caching.
   *
   * @param tokenIdOrTokenAddr - Token ID or token script hash to query
   * @param scope - Token type scope (Fungible for CAT-20, NonFungible for CAT-721)
   * @returns Object containing totalSupply (as string) and current tracker block height
   */
  async getTokenTotalSupply(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
  ) {
    const totalSupplyKey = `totalSupply-${tokenIdOrTokenAddr}-${scope}`;
    let cache = TokenService.totalSupplyCache.get(totalSupplyKey);
    if (cache !== null && cache !== undefined) {
      return cache;
    }

    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    const trackerBlockHeight = await this.commonService.getLastProcessedBlockHeight();
    if (!tokenInfo?.tokenScriptHash || trackerBlockHeight === null) {
      return {
        totalSupply: '0',
        trackerBlockHeight,
      };
    }

    cache = {
      totalSupply: await this.queryTokenTotalSupply(tokenInfo.tokenScriptHash, scope),
      trackerBlockHeight,
    };
    TokenService.totalSupplyCache.set(totalSupplyKey, cache);

    return cache;
  }

  /**
   * Calculate the total supply of a token.
   *
   * Supply Terminology Clarification:
   * - **totalSupply**: The total amount of tokens currently in circulation (unspent UTXOs).
   *   This represents tokens that exist and are available for use. For fungible tokens (CAT-20),
   *   it's the sum of all unspent token amounts. For non-fungible tokens (CAT-721), it's the count
   *   of all unspent NFTs.
   *
   * - **supply**: Generally synonymous with totalSupply in this context, representing circulating tokens.
   *
   * - **maxSupply**: The maximum possible supply that can ever exist for a token. This is a fixed
   *   limit defined at token creation. Not currently tracked or returned by this method.
   *
   * - **circulating supply**: The amount of tokens actively available for trading in the market.
   *   - Includes:
   *     - Tokens held by users that can be freely bought and sold
   *     - Tokens circulating on exchanges
   *     - Tokens in DeFi protocols that can be withdrawn at any time
   *   - Excludes:
   *     - Tokens locked by team/foundation
   *     - Tokens locked in staking (depending on whether they can be immediately unlocked)
   *     - Burned tokens
   *     - Tokens in long-inactive "dead" wallets (sometimes excluded)
   *
   * **CAT-20 Example:**
   * Consider a CAT-20 token with the following state:
   * - Max mintable: 21,000,000 tokens (defined at token creation)
   * - Already minted: 15,000,000 tokens (tracked by totalMintedAmount)
   * - Burned: 1,000,000 tokens (spent to unspendable outputs)
   * - Locked in staking: 3,000,000 tokens (held in staking contracts)
   * - Locked by foundation: 2,000,000 tokens (held in foundation addresses)
   * - Available for trading: 9,000,000 tokens (remaining unspent tokens)
   *
   * **Calculation Formulas:**
   * ```
   * totalMintedAmount = 15,000,000  (sum of all minted tokens from token_mint table)
   * burned = 1,000,000              (not tracked separately in current implementation)
   * lockedInStaking = 3,000,000     (not tracked separately in current implementation)
   * lockedByFoundation = 2,000,000  (not tracked separately in current implementation)
   * totalSupply = 14,000,000        (sum of all unspent token UTXOs)
   *
   * totalSupply = totalMintedAmount - burned
   *             = 15,000,000 - 1,000,000
   *             = 14,000,000
   *
   * totalSupply = lockedInStaking + lockedByFoundation + availableForTrading
   *             = 3,000,000 + 2,000,000 + 9,000,000
   *             = 14,000,000
   *
   * True circulating supply (market-tradable tokens):
   * circulating supply = totalSupply - lockedInStaking - lockedByFoundation
   *                    = 14,000,000 - 3,000,000 - 2,000,000
   *                    = 9,000,000
   *
   * In this implementation (no separate tracking of locked tokens):
   * circulating supply ≈ totalSupply = 14,000,000
   * ```
   *
   * **Size Relationships:**
   * ```
   * maxSupply >= totalMintedAmount >= totalSupply >= circulating supply (market-tradable) >= 0
   * 21,000,000 >= 15,000,000 >= 14,000,000 >= 9,000,000 >= 0
   * ```
   * 
   * @param tokenScriptHash - Token script hash to query
   * @param scope - Token type scope (Fungible for CAT-20, NonFungible for CAT-721)
   * @returns Object containing totalSupply (as string) and current tracker block height
   */
  private async queryTokenTotalSupply(
    tokenScriptHash: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
  ): Promise<string> {
    let totalSupply = '0';
      const where = {
        lockingScriptHash: tokenScriptHash,
        spendTxid: IsNull(),
      };
      if (scope === TokenTypeScope.Fungible) {
        const r = await this.txOutRepository
          .createQueryBuilder()
          .select('SUM(token_amount)', 'count')
          .where(where)
          .getRawOne();
        totalSupply = r?.count || '0';
      } else {
        const r = await this.txOutRepository.count({ where });
        totalSupply = (r || 0).toString();
      }
    return totalSupply;
  }


  private async queryTokenTotalHolders(tokenScriptHash: string): Promise<number> {
    const query = this.txOutRepository
      .createQueryBuilder()
      .select('COUNT(DISTINCT owner_pkh)', 'count')
      .where('spend_txid IS NULL')
      .andWhere('locking_script_hash = :tokenScriptHash', {
        tokenScriptHash,
      });

    const result = await query.getRawOne();
    return Number(result?.count || '0');
  }

  async getTokenTotalHolders(tokenIdOrTokenScriptHash: string, scope: TokenTypeScope) {
    const totalHoldersKey = `totalHolders-${tokenIdOrTokenScriptHash}-${scope}`;
    let cache = TokenService.totalHoldersCache.get(totalHoldersKey);
    if (cache !== null && cache !== undefined) {
      return cache;
    }
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash, scope);
    if (!tokenInfo?.tokenScriptHash || lastProcessedHeight === null) {
      return {
        totalHolders: 0,
        trackerBlockHeight: lastProcessedHeight,
      }
    }
    const totalHolders = await this.queryTokenTotalHolders(tokenInfo.tokenScriptHash);
    cache = {
      totalHolders: totalHolders,
      trackerBlockHeight: lastProcessedHeight,
    }
    TokenService.totalHoldersCache.set(totalHoldersKey, cache);
    return cache;
  }

  private async queryTokenHolderList(
    tokenScriptHash: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
    offset: number,
    limit: number
  ): Promise<Array<{
    ownerPubKeyHash: string;
    balance: string;
  }>> {
    // Using TypeORM Query Builder avoids column name case sensitivity issues
    const queryBuilder = this.txOutRepository
      .createQueryBuilder('txOut')
      .select('txOut.ownerPubKeyHash', 'ownerPubKeyHash')
      .where('txOut.spendTxid IS NULL')
      .andWhere('txOut.lockingScriptHash = :tokenScriptHash', { tokenScriptHash })
      .groupBy('txOut.ownerPubKeyHash')
      .offset(offset)
      .limit(limit);

    if (scope === TokenTypeScope.Fungible) {
      // For fungible tokens, sum up the token amounts for each owner
      // Note: COALESCE handles NULL values, returns '0' if all amounts are NULL
      queryBuilder.addSelect('COALESCE(SUM(txOut.tokenAmount), 0)', 'balance');
      queryBuilder.orderBy('balance', 'DESC');
    } else {
      // For non-fungible tokens, count the number of NFTs for each owner
      queryBuilder.addSelect('COALESCE(COUNT(*), 0)', 'balance');
      queryBuilder.orderBy('balance', 'DESC');
    }

    const holders = await queryBuilder.getRawMany();

    return holders.map(holder => ({
      ownerPubKeyHash: holder.ownerPubKeyHash,
      // COALESCE ensures balance is never NULL, so we can safely convert to string
      // PostgreSQL NUMERIC type is returned as string by node-postgres driver
      balance: String(holder.balance ?? '0')
    }));
  }

  async getTokenHolders(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
    offset: number | null = null,
    limit: number | null = null,
  ): Promise<{
    holders: {
      address: string;
      balance: string;
      percentage: number;
      rank: number
    }[];
    total: number;
    trackerBlockHeight: number;
  }> {

    const finalOffset = Number(offset || 0);
    const finalLimit = Math.min(Number(limit) || Constants.QUERY_PAGING_DEFAULT_LIMIT, Constants.QUERY_PAGING_MAX_LIMIT);
    const key = `holders-${tokenIdOrTokenAddr}-${scope}-${finalOffset}-${finalLimit}`;

    let cache = TokenService.holdersCache.get(key);
    if (cache) {
      return cache;
    }

    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    if (!tokenInfo?.tokenScriptHash || lastProcessedHeight === null) {
      return {
        holders: [],
        total: 0,
        trackerBlockHeight: lastProcessedHeight
      };
    }
    const [holders, totalSupply, totalHolders] = await Promise.all([
      this.queryTokenHolderList(tokenInfo.tokenScriptHash, scope, finalOffset, finalLimit),
      this.queryTokenTotalSupply(tokenInfo.tokenScriptHash, scope),
      this.queryTokenTotalHolders(tokenInfo.tokenScriptHash)
    ]);

    const result = holders.map((holder, index) => ({
      address: pubKeyHashToOwnerAddress(holder.ownerPubKeyHash, this.network),
      balance: holder.balance,
      percentage: this.calculateHolderPercentage(holder.balance, BigInt(totalSupply)),
      rank: finalOffset + index + 1
    }));
    cache = {
      holders: result,
      total: totalHolders,
      trackerBlockHeight: lastProcessedHeight
    };
    TokenService.holdersCache.set(key, cache);
    return cache;
  }

  private async _getTokenIcon(tokenIdOrScriptHash: string): Promise<CachedContent | null> {
    const tokenContent = await this.tokenInfoRepository.findOne({
      select: ['rawInfo', 'createdAt'],
      where: { tokenId: tokenIdOrScriptHash },
    });
    if (tokenContent) {
      try {
        const tokenInfo = MetadataSerializer.deserialize(tokenContent.rawInfo);
        if (tokenInfo.type !== 'Token') {
          return null;
        }
        if (!tokenInfo.info.metadata.icon) {
          return null;
        }
        const {type, body} = tokenInfo.info.metadata.icon;
        const contentType = MetadataSerializer.decodeContentType(type);
        const contentRaw = Buffer.from(body, 'hex');
        return {
          type: contentType,
          encoding: tokenInfo.info.contentEncoding,
          raw: contentRaw,
          lastModified: tokenContent.createdAt,
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async getTokenIcon(tokenIdOrScriptHash: string): Promise<CachedContent | null> {
    const key = `${tokenIdOrScriptHash}`;
    let cached = TokenService.tokenIconCache.get(key);
    if (!cached) {
      cached = await this._getTokenIcon(tokenIdOrScriptHash);
    }
    if (cached) {
      TokenService.tokenIconCache.set(key, cached);
    }
    return cached;
  }

  private calculateHolderPercentage(holderAmount: string, totalAmount: bigint): number {
    if (totalAmount === 0n) {
      return 0;
    }
    // Use Decimal.js to handle arbitrary precision arithmetic
    // This avoids both BigInt truncation and Number overflow issues
    const holderAmountDecimal = new Decimal(holderAmount || '0');
    const totalAmountDecimal = new Decimal(totalAmount.toString());
    const percentage = holderAmountDecimal.div(totalAmountDecimal).mul(100);
    return percentage.toNumber();
  }
}
