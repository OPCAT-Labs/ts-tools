import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TokenInfoEntity } from '../../entities/tokenInfo.entity';
import { IsNull, LessThanOrEqual, Repository, MoreThanOrEqual, LessThan, Like, ILike } from 'typeorm';
import { ownerAddressToPubKeyHash, xOnlyPubKeyToAddress } from '../../common/utils';
import { TxOutEntity } from '../../entities/txOut.entity';
import { TxOutArchiveEntity } from '../../entities/txOutArchive.entity';
import { Constants } from '../../common/constants';
import { LRUCache } from 'lru-cache';
import { TxEntity } from '../../entities/tx.entity';
import { CommonService } from '../../services/common/common.service';
import { TokenTypeScope } from '../../common/types';
import { TokenMintEntity } from '../../entities/tokenMint.entity';
import { HttpStatusCode } from 'axios';
import { of } from 'rxjs';

@Injectable()
export class TokenService {
  // tx stateHashes and txHashPreimage cache
  private static readonly txCache = new LRUCache<string, TxEntity>({
    max: Constants.CACHE_MAX_SIZE,
  });

  private static readonly tokenInfoCache = new LRUCache<string, TokenInfoEntity>({
    max: Constants.CACHE_MAX_SIZE,
  });

  private static readonly holdersCache = new LRUCache<string, any>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  });

  private static readonly holdersNumCache = new LRUCache<string, any>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  });

  private static readonly supplyCache = new LRUCache<string, any>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  });

  private static readonly totalTransNumCache = new LRUCache<string, any>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  });

  private static readonly mintedAmountCache = new LRUCache<string, any>({
    max: Constants.CACHE_MAX_SIZE,
    ttl: 5 * 60 * 1000,
    ttlAutopurge: true
  });

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
  ) { }

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
          'rawInfo',
          'minterScriptHash',
          'tokenScriptHash',
          'firstMintHeight',
          'premine',
          'tokenLimit',
          'deployBlock',
          'deployTxid',
          'deployTime'
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

    const cached = TokenService.holdersCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();

    try {
      let whereCondition: any = {};

      if (scope === TokenTypeScope.Fungible) {
        whereCondition.decimals = MoreThanOrEqual(0);
      } else if (scope === TokenTypeScope.NonFungible) {
        whereCondition.decimals = LessThan(0);
      }

      if (query && query.trim()) {
        whereCondition = [
          {
            ...whereCondition,
            tokenId: ILike(`%${query.trim()}%`)
          },
          {
            ...whereCondition,
            name: ILike(`%${query.trim()}%`)
          },
          {
            ...whereCondition,
            symbol: ILike(`%${query.trim()}%`)
          }
        ];
      }

      const [tokens, total] = await this.tokenInfoRepository.findAndCount({
        select: [
          'tokenId',
          'name',
          'symbol',
          'decimals',
          'logoUrl'
        ],
        where: whereCondition,
        skip: finalOffset,
        take: finalLimit,
        order: {
          deployTime: 'DESC'
        }
      });

      const result = {
        tokens: tokens.map(token => this.renderTokenInfo(token)),
        total: total,
        trackerBlockHeight: lastProcessedHeight
      };

      TokenService.holdersCache.set(cacheKey, result);

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

  private async queryHoldersCount(tokenScriptHash: string, repository: Repository<any>): Promise<number> {
    const query = repository
      .createQueryBuilder()
      .select('COUNT(DISTINCT owner_pkh)', 'count')
      .where('spend_txid IS NULL')
      .andWhere('locking_script_hash = :tokenScriptHash', {
        tokenScriptHash,
      });

    const result = await query.getRawOne();
    return Number(result?.count || '0');
  }

  async getTokenHoldersNumByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash: string, scope: TokenTypeScope) {
    const holdersNumKey = `holdersNum-${tokenIdOrTokenScriptHash}-${scope}`;
    const cachedHoldersNum = TokenService.holdersNumCache.get(holdersNumKey);

    if (cachedHoldersNum !== null && cachedHoldersNum !== undefined) {
      return cachedHoldersNum;
    }

    const cached = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash, scope);
    let holdersNum = 0;

    if (cached?.tokenScriptHash) {
      const [outHoldersNum, outArchiveHoldersNum] = await Promise.all([
        this.queryHoldersCount(cached.tokenScriptHash, this.txOutRepository),
        this.queryHoldersCount(cached.tokenScriptHash, this.txOutArchiveRepository)
      ]);

      holdersNum = outHoldersNum + outArchiveHoldersNum;
    }

    TokenService.holdersNumCache.set(holdersNumKey, holdersNum);
    return holdersNum;
  }

  private async queryTokenSupply(tokenScriptHash: string, repository: Repository<any>): Promise<string> {
    const query = repository
      .createQueryBuilder()
      .select('SUM(token_amount)', 'amount')
      .where('spend_txid IS NULL')
      .andWhere('locking_script_hash = :tokenScriptHash', {
        tokenScriptHash,
      });

    const result = await query.getRawOne();
    return result?.amount || '0';
  }

  async getTokenSupplyByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash: string, scope: TokenTypeScope) {
    const supplyKey = `supply-${tokenIdOrTokenScriptHash}-${scope}`;
    const cachedSupply = TokenService.supplyCache.get(supplyKey);

    if (cachedSupply !== null && cachedSupply !== undefined) {
      return cachedSupply;
    }

    const cached = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash, scope);
    let supply = '0';

    if (cached?.tokenScriptHash) {
      const [mainSupply, archiveSupply] = await Promise.all([
        this.queryTokenSupply(cached.tokenScriptHash, this.txOutRepository),
        this.queryTokenSupply(cached.tokenScriptHash, this.txOutArchiveRepository)
      ]);
      const totalSupply = BigInt(mainSupply) + BigInt(archiveSupply);
      supply = totalSupply.toString();
    }

    TokenService.supplyCache.set(supplyKey, supply);
    return supply;
  }

  private async queryTransactionCount(tokenScriptHash: string, repository: Repository<any>): Promise<number> {
    const query = repository
      .createQueryBuilder()
      .select('COUNT(DISTINCT txid)', 'count')
      .where('locking_script_hash = :tokenScriptHash', {
        tokenScriptHash,
      });

    const result = await query.getRawOne();
    return Number(result?.count || '0');
  }

  async getTokenTotalTransNumByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash: string, scope: TokenTypeScope) {
    const totalTransNumKey = `totalTransNum-${tokenIdOrTokenScriptHash}-${scope}`;
    const cachedTotalTransNum = TokenService.totalTransNumCache.get(totalTransNumKey);

    if (cachedTotalTransNum !== null && cachedTotalTransNum !== undefined) {
      return cachedTotalTransNum;
    }

    const cached = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenScriptHash, scope);
    let totalTransNum = 0;

    if (cached?.tokenScriptHash) {
      const [mainTransNum, archiveTransNum] = await Promise.all([
        this.queryTransactionCount(cached.tokenScriptHash, this.txOutRepository),
        this.queryTransactionCount(cached.tokenScriptHash, this.txOutArchiveRepository)
      ]);

      totalTransNum = mainTransNum + archiveTransNum;
    }

    TokenService.totalTransNumCache.set(totalTransNumKey, totalTransNum);
    return totalTransNum;
  }

  async getTokenInfoByTokenPubKey(tokenPubKey: string, scope: TokenTypeScope) {
    const tokenAddr = xOnlyPubKeyToAddress(tokenPubKey);
    return this.getTokenInfoByTokenIdOrTokenScriptHash(tokenAddr, scope);
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
    if (tokenInfo) {
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
    console.log('ownerPubKeyHash: ', ownerPubKeyHash);
    if (lastProcessedHeight === null || (tokenInfo && !tokenInfo.tokenScriptHash) || !ownerPubKeyHash) {
      return [];
    }
    const where = {
      ownerPubKeyHash,
      spendTxid: IsNull(),
      // blockHeight: LessThanOrEqual(lastProcessedHeight),
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
      .addSelect('t2.name', 'name')
      .addSelect('t2.symbol', 'symbol')
      .addSelect('t2.logo_url', 'logoUrl')
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
      name: r.name,
      symbol: r.symbol,
      logoUrl: r.logoUrl,
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
        satoshis: utxo.satoshis,
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

  async getTokenMintAmount(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
  ): Promise<{
    amount: string;
    trackerBlockHeight: number;
  }> {

    const mintedAmountKey = `mintedAmount-${tokenIdOrTokenAddr}-${scope}`;
    const cachedMintedAmount = TokenService.mintedAmountCache.get(mintedAmountKey);

    if (cachedMintedAmount !== null && cachedMintedAmount !== undefined) {
      return cachedMintedAmount;
    }

    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    let amount = '0';
    if (tokenInfo && tokenInfo.tokenScriptHash && lastProcessedHeight) {
      const where = {
        tokenScriptHash: tokenInfo.tokenScriptHash,
        blockHeight: LessThanOrEqual(lastProcessedHeight),
      };
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
    }

    const result = {
      amount,
      trackerBlockHeight: lastProcessedHeight,
    };
    TokenService.mintedAmountCache.set(mintedAmountKey, result);

    return result;
  }

  async getTokenCirculation(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
  ): Promise<{
    amount: string;
    trackerBlockHeight: number;
  }> {
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);
    let amount = '0';
    if (tokenInfo && tokenInfo.tokenScriptHash && lastProcessedHeight) {
      const where = {
        lockingScriptHash: tokenInfo.tokenScriptHash,
        spendTxid: IsNull(),
      };
      if (scope === TokenTypeScope.Fungible) {
        const r = await this.txOutRepository
          .createQueryBuilder()
          .select('SUM(token_amount)', 'count')
          .where(where)
          .getRawOne();
        amount = r?.count || '0';
      } else {
        const r = await this.txOutRepository.count({ where });
        amount = (r || 0).toString();
      }
    }
    return {
      amount,
      trackerBlockHeight: lastProcessedHeight,
    };
  }

  async getTokenHolders(
    tokenIdOrTokenAddr: string,
    scope: TokenTypeScope.Fungible | TokenTypeScope.NonFungible,
    offset: number | null = null,
    limit: number | null = null,
  ): Promise<{
    holders: {
      ownerPubKeyHash: string;
      tokenAmount?: string;
      nftAmount?: number;
      percentage: number;
    }[];
    total: number;
    trackerBlockHeight: number;
  }> {

    const finalOffset = offset || 0;
    const finalLimit = Math.min(limit || Constants.QUERY_PAGING_DEFAULT_LIMIT, Constants.QUERY_PAGING_MAX_LIMIT);
    const key = `holders-${tokenIdOrTokenAddr}-${scope}-${finalOffset}-${finalLimit}`;

    const cached = TokenService.holdersCache.get(key);
    if (cached) {
      return cached;
    }

    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    const tokenInfo = await this.getTokenInfoByTokenIdOrTokenScriptHash(tokenIdOrTokenAddr, scope);

    if (!tokenInfo?.tokenScriptHash || !lastProcessedHeight) {
      return {
        holders: [],
        total: 0,
        trackerBlockHeight: lastProcessedHeight
      };
    }

    try {
      const [holdersData, totalSupply] = await Promise.all([
        this.queryHoldersFromBothTables(tokenInfo.tokenScriptHash, scope, finalOffset, finalLimit),
        scope === TokenTypeScope.Fungible
          ? this.queryTotalSupplyFromBothTables(tokenInfo.tokenScriptHash)
          : Promise.resolve('0')
      ]);

      const totalTokenAmount = BigInt(totalSupply || '0');

      const holdersList = holdersData?.holders || [];
      const holdersWithPercentage = holdersList.map(holder => ({
        ...holder,
        percentage: scope === TokenTypeScope.Fungible
          ? this.calculateHolderPercentage(holder.tokenAmount || '0', totalTokenAmount)
          : 0
      }));

      const result = {
        holders: holdersWithPercentage,
        total: holdersData.total,
        trackerBlockHeight: lastProcessedHeight
      };

      TokenService.holdersCache.set(key, result);

      return result;
    } catch (error) {
      console.error('Error in getTokenHolders:', error);
      return {
        holders: [],
        total: 0,
        trackerBlockHeight: lastProcessedHeight
      };
    }

  }

  private async queryHoldersFromBothTables(
    tokenScriptHash: string,
    scope: TokenTypeScope,
    offset: number,
    limit: number
  ): Promise<{
    holders: Array<{
      ownerPubKeyHash: string;
      tokenAmount?: string;
      nftAmount?: number;
    }>;
    total: number;
  }> {
    try {
      let unionQuery: string;
      if (scope === TokenTypeScope.Fungible) {
        unionQuery = `
                      SELECT owner_pkh as ownerPubKeyHash,SUM(token_amount)::BIGINT as tokenAmount
                      FROM tx_out 
                      WHERE spend_txid IS NULL AND locking_script_hash = $1
                      GROUP BY owner_pkh
                      UNION ALL
                      SELECT owner_pkh as ownerPubKeyHash, SUM(token_amount)::BIGINT as tokenAmount
                      FROM tx_out_archive 
                      WHERE spend_txid IS NULL AND locking_script_hash = $2
                      GROUP BY owner_pkh
                  `;
      } else {
        unionQuery = `
                      SELECT owner_pkh as ownerPubKeyHash,  COUNT(1) as nftAmount
                      FROM tx_out 
                      WHERE spend_txid IS NULL AND locking_script_hash = $1
                      GROUP BY owner_pkh
                      UNION ALL
                      SELECT owner_pkh as ownerPubKeyHash,  COUNT(1) as nftAmount
                      FROM tx_out_archive 
                      WHERE spend_txid IS NULL AND locking_script_hash = $2
                      GROUP BY owner_pkh
                  `;
      }

      let finalQuery: string;
      let orderBy: string;

      if (scope === TokenTypeScope.Fungible) {
        orderBy = 'tokenAmount DESC';
        finalQuery = `
                    SELECT 
                      ownerPubKeyHash,                    
                      SUM(tokenAmount)::BIGINT as tokenAmount
                    FROM (${unionQuery}) as combined
                    GROUP BY ownerPubKeyHash
                    ORDER BY ${orderBy}
                    LIMIT $3 OFFSET $4
                  `;
      } else {
        orderBy = 'nftAmount DESC';
        finalQuery = `
                      SELECT 
                        ownerPubKeyHash,                      
                        SUM(nftAmount)::BIGINT as nftAmount
                      FROM (${unionQuery}) as combined
                      GROUP BY ownerPubKeyHash
                      ORDER BY ${orderBy}
                      LIMIT $3 OFFSET $4
                    `;
      }
      const countQuery = `
                          SELECT COUNT(DISTINCT combined.ownerPubKeyHash) as total
                          FROM (${unionQuery}) as combined
                        `;

      const holdersParams = [tokenScriptHash, tokenScriptHash, limit, offset];
      const countParams = [tokenScriptHash, tokenScriptHash];

      const [holders, countResult] = await Promise.all([
        this.txOutRepository.query(finalQuery, holdersParams),
        this.txOutRepository.query(countQuery, countParams)
      ]);

      return {
        holders: holders.map(holder => ({
          ownerPubKeyHash: holder.ownerpubkeyhash || holder.ownerPubKeyHash,       
          ...(scope === TokenTypeScope.Fungible
            ? { tokenAmount: holder.tokenamount || '0' }
            : { nftAmount: parseInt(holder.nftamount || '0') }
          )
        })),
        total: parseInt(countResult[0]?.total || '0')
      };
    } catch (error) {
      console.error('Error querying holders from both tables:', error);
    }

  }

  private async queryTotalSupplyFromBothTables(tokenScriptHash: string): Promise<string> {

    try {
      const query = `
                  SELECT SUM(total_amount)::BIGINT as totalSupply FROM (
                      SELECT SUM(token_amount)::BIGINT as total_amount
                      FROM tx_out 
                      WHERE spend_txid IS NULL AND locking_script_hash = $1
                    UNION ALL
                      SELECT SUM(token_amount)::BIGINT as total_amount
                      FROM tx_out_archive 
                      WHERE spend_txid IS NULL AND locking_script_hash = $2
                  ) as combined
                `;

      const result = await this.txOutRepository.query(query, [tokenScriptHash, tokenScriptHash]);
      return result[0]?.totalsupply || '0';

    } catch (error) {
      console.error('Error querying total supply from both tables:', error);
    }

  }

  private calculateHolderPercentage(holderAmount: string, totalAmount: bigint): number {
    if (totalAmount === 0n) {
      return 0;
    }
    const holderAmountBigInt = BigInt(holderAmount || '0');
    const percentage = (holderAmountBigInt * 10000n) / totalAmount;
    return Number(percentage) / 100;
  }

}