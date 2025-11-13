import { Injectable, Logger } from '@nestjs/common';
import { TxEntity } from '../../entities/tx.entity';
import { DataSource, EntityManager, In, MoreThanOrEqual, Repository } from 'typeorm';
import { Transaction } from '@opcat-labs/opcat';
import { TxOutEntity } from '../../entities/txOut.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Constants } from '../../common/constants';
import { TokenInfoEntity } from '../../entities/tokenInfo.entity';
import { NftInfoEntity } from '../../entities/nftInfo.entity';
import { CatTxError, TransferTxError } from '../../common/exceptions';
import { BlockHeader } from '../../common/types';
import { TokenMintEntity } from '../../entities/tokenMint.entity';
import { LRUCache } from 'lru-cache';
import { CommonService } from '../common/common.service';
import { TxOutArchiveEntity } from 'src/entities/txOutArchive.entity';
import { Cron } from '@nestjs/schedule';
import { byteStringToInt, toHex, sha256, uint8ArrayToHex } from '@opcat-labs/scrypt-ts-opcat';
import { ContractLib } from '../../common/contract';
import { RpcService } from '../rpc/rpc.service';
import { ZmqService } from '../zmq/zmq.service';
import { CatTags, MetadataSerializer } from '@opcat-labs/cat-sdk';

@Injectable()
export class TxService {
  private readonly logger = new Logger(TxService.name);

  private static readonly taprootPaymentCache = new LRUCache<string, { pubkey: Buffer; redeemScript: Buffer }>({
    max: Constants.CACHE_MAX_SIZE,
  });

  private static readonly tokenInfoCache = new LRUCache<string, TokenInfoEntity>({
    max: Constants.CACHE_MAX_SIZE,
  });

  private dataSource: DataSource;

  constructor(
    private readonly rpcService: RpcService,
    private commonService: CommonService,
    @InjectRepository(TokenInfoEntity)
    private tokenInfoEntityRepository: Repository<TokenInfoEntity>,
    @InjectRepository(TxEntity)
    private txEntityRepository: Repository<TxEntity>,
    @InjectRepository(TxOutEntity)
    private txOutEntityRepository: Repository<TxOutEntity>,
    @InjectRepository(NftInfoEntity)
    private nftInfoEntityRepository: Repository<NftInfoEntity>,
    private zmqService: ZmqService,
  ) {
    this.dataSource = this.txEntityRepository.manager.connection;
    this.zmqService.onRawTx(async (buff: Buffer) => {
      this.logger.debug(`onRawTx ${uint8ArrayToHex(buff)}`);
      this.logger.debug(`onRawTx ${buff.toString('hex')}`);
      const tx = Transaction.fromBuffer(buff);
      await this.processTx(tx, -1, null);
    });
    this.zmqService.onHashBlock((blockHash: Buffer) => {
      this.logger.debug(`onHashBlock ${uint8ArrayToHex(blockHash)}`);
      this.logger.debug(`onHashBlock ${blockHash.toString('hex')}`);
    });
  }

  /**
   * Process a transaction
   * @param tx transaction to save
   * @param txIndex index of this transaction in the block
   * @param blockHeader header of the block that contains this transaction
   * @returns processing time in milliseconds if successfully processing a CAT-related tx, otherwise undefined
   */
  async processTx(tx: Transaction, txIndex: number, blockHeader: BlockHeader | null) {
    if (tx.isCoinbase()) {
      return;
    }

    const startTs = Date.now();
    try {
      this.updateSpent(tx);

      await this.commonService.txAddPrevouts(tx);
      // get tags
      const inputTags = ContractLib.decodeInputsTag(tx);
      const outputTags = ContractLib.decodeOutputsTag(tx);
      const outputFields = ContractLib.decodeAllOutputFields(tx);
      const inputMetadatas = ContractLib.decodeAllInputMetadata(tx);
      const tags = inputTags.flat().concat(outputTags.flat());
      let isSaveTx = false;
      if (
        inputMetadatas[0]?.type === 'Token' ||
        inputMetadatas[0]?.type === 'Collection'
      ) {
        isSaveTx = isSaveTx || (await this.processMetaTx(tx, outputTags, inputMetadatas[0], blockHeader));
        this.logger.log(`[OK] genesis tx ${tx.id}, type: ${inputMetadatas[0]?.type}`);
      }
      //
      if (inputTags[0].includes(CatTags.CAT20_MINTER_TAG) || inputTags[0].includes(CatTags.CAT721_MINTER_TAG)) {
        // search minter in inputs
        isSaveTx = isSaveTx || (await this.processMintTx(tx, outputTags, inputMetadatas, blockHeader, outputFields));
        this.logger.log(`[OK] mint tx ${tx.id}`);
      }
      if (tags.includes(CatTags.CAT20_TAG) || tags.includes(CatTags.CAT721_TAG)) {
        isSaveTx = isSaveTx || (await this.processTransferTx(tx, outputTags, blockHeader, outputFields));
        this.logger.log(`[OK] transfer tx ${tx.id}`);
      }
      if (isSaveTx) {
        await this.saveTx(tx, txIndex, blockHeader);
      }

      return Math.ceil(Date.now() - startTs);
    } catch (e) {
      if (e instanceof TransferTxError) {
        this.logger.error(`[502750] invalid transfer tx ${tx.id}, ${e.message}`);
      } else {
        if (e instanceof CatTxError) {
          this.logger.log(`skip tx ${tx.id}, ${e.message}`);
        } else {
          this.logger.error(`process tx ${tx.id} error, ${e.message} ${e.stack}`);
        }
      }
    }
    // return Math.ceil(Date.now() - startTs);
  }

  private async updateSpent(tx: Transaction) {
    await Promise.all(
      tx.inputs.map((input, i) => {
        const prevTxid = input.prevTxId.toString('hex');
        const prevOutputIndex = input.outputIndex;
        return this.txOutEntityRepository.update(
          {
            txid: prevTxid,
            outputIndex: prevOutputIndex,
          },
          {
            spendTxid: tx.id,
            spendInputIndex: i,
          },
        );
      }),
    );
  }

  private async saveTx(tx: Transaction, txIndex: number, blockHeader: BlockHeader | null) {
    return this.txEntityRepository.save({
      txid: tx.id,
      blockHeight: blockHeader ? blockHeader.height : 2147483647,
      txIndex,
    });
  }

  private async processMetaTx(
    tx: Transaction,
    outputTags: string[][],
    inputMetadata: ReturnType<typeof MetadataSerializer.deserialize>,
    blockHeader: BlockHeader | null,
  ) {
    const promises: Promise<any>[] = [];
    const input = tx.inputs[0];
    const inputGenesis = input.output;
    const tokenId = `${input.prevTxId.toString('hex')}_${input.outputIndex}`;
    // const [, _name, _symbol, _decimals] = fields;
    let _name = ''
    let _symbol = ''
    let _decimals = 0n
    let hasAdmin = false
    if (inputMetadata.type == 'Token') {
      _name = inputMetadata.info.metadata.name;
      _symbol = inputMetadata.info.metadata.symbol;
      _decimals = BigInt(inputMetadata.info.metadata.decimals)
      hasAdmin = inputMetadata.info.metadata.hasAdmin || false
    } else if (inputMetadata.type == 'Collection') {
      _name = inputMetadata.info.metadata.name;
      _symbol = inputMetadata.info.metadata.symbol;
      _decimals = BigInt(Constants.CAT721_DECIMALS);
    }
    const decimals = Number(_decimals);
    const tokenInfoEntity = this.tokenInfoEntityRepository.create({
      tokenId,
      genesisTxid: tx.hash,
      name: _name,
      symbol: _symbol,
      decimals: decimals,
      hasAdmin: hasAdmin,
      rawInfo: toHex(inputGenesis.data),
    });
    let adminScriptHash = sha256('');
    const adminIndex = outputTags.findIndex((tags) => tags.includes(CatTags.CAT20_ADMIN_TAG));
    if (adminIndex !== -1 && tx.outputs.length > adminIndex) {
      adminScriptHash = sha256(tx.outputs[adminIndex].script.toHex());
    }
    // promises.push(p);
    for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
      const output = tx.outputs[outputIndex];
      const outputTag = outputTags[outputIndex];
      const lockingScriptHash = sha256(tx.outputs[outputIndex].script.toHex());
      if (
        outputTag.includes(CatTags.CAT20_MINTER_TAG) ||
        outputTag.includes(CatTags.CAT721_MINTER_TAG) 
      ) {
        const txOut = this.txOutEntityRepository.create();
        tokenInfoEntity.minterScriptHash = lockingScriptHash;
        tokenInfoEntity.adminScriptHash = adminScriptHash;
        txOut.txid = tx.hash;
        txOut.outputIndex = outputIndex;
        txOut.blockHeight = blockHeader ? blockHeader.height : 2147483647;
        txOut.satoshis = BigInt(output.satoshis);
        txOut.lockingScriptHash = lockingScriptHash;
        txOut.isFromMint = true;
        txOut.tokenAmount = 0n;
        txOut.data = toHex(output.data);
        // Use upsert() instead of save() for composite primary key (txid, outputIndex)
        // to avoid duplicate key errors when transaction is processed multiple times
        // See: https://github.com/typeorm/typeorm/issues/720
        promises.push(this.txOutEntityRepository.upsert(txOut, ['txid', 'outputIndex']));
      }
    }
    promises.push(this.tokenInfoEntityRepository.save(tokenInfoEntity));
    await Promise.all(promises);
    return promises.length > 0;
  }

  private async processMintTx(
    tx: Transaction,
    outputTags: string[][],
    inputMetadatas: ReturnType<typeof MetadataSerializer.deserialize>[],
    blockHeader: BlockHeader | null,
    outputFields: string[][],
  ) {
    const promises: Promise<any>[] = [];
    const inputTokenInfos = await this.tokenInfoEntityRepository.find({
      where: {
        minterScriptHash: In(tx.inputs.map((input) => sha256(input.output.script.toHex()))),
      },
    });
    for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
      const outputTag = outputTags[outputIndex];
      const output = tx.outputs[outputIndex];
      const lockingScriptHash = sha256(tx.outputs[outputIndex].script.toHex());
      if (
        outputTag.includes(CatTags.CAT20_MINTER_TAG) ||
        outputTag.includes(CatTags.CAT721_MINTER_TAG)
      ) {
        const txOut = this.txOutEntityRepository.create();
        txOut.txid = tx.hash;
        txOut.outputIndex = outputIndex;
        txOut.blockHeight = blockHeader ? blockHeader.height : 2147483647;
        txOut.satoshis = BigInt(output.satoshis);
        txOut.lockingScriptHash = lockingScriptHash;
        txOut.isFromMint = true;
        txOut.tokenAmount = 0n;
        txOut.data = toHex(output.data);

        const tokenInfo = inputTokenInfos.find((m) => m.minterScriptHash == lockingScriptHash);
        const backtraceValid = this.commonService.checkMinterBacktrace(txOut, tokenInfo, tx);
        if (backtraceValid) {
          // Use upsert() instead of save() for composite primary key (txid, outputIndex)
          // to avoid duplicate key errors when transaction is processed multiple times
          // See: https://github.com/typeorm/typeorm/issues/720
          promises.push(this.txOutEntityRepository.upsert(txOut, ['txid', 'outputIndex']));
        }
      } else if (
        outputTag.includes(CatTags.CAT20_TAG) ||
        outputTag.includes(CatTags.CAT721_TAG)
      ) {
        const tokenInfoToUpdate = inputTokenInfos.find((m) => !m.tokenScriptHash);
        if (tokenInfoToUpdate) {
          tokenInfoToUpdate.tokenScriptHash = lockingScriptHash;
          promises.push(this.tokenInfoEntityRepository.save(tokenInfoToUpdate));
        }
        const tokenInfoToUpdateFirstMintHeight = inputTokenInfos.find((m) => m.tokenScriptHash == lockingScriptHash);
        if (blockHeader && tokenInfoToUpdateFirstMintHeight.firstMintHeight == null) {
          tokenInfoToUpdateFirstMintHeight.firstMintHeight = blockHeader.height;
          promises.push(this.tokenInfoEntityRepository.save(tokenInfoToUpdateFirstMintHeight));
        }
        const outputField = outputFields[outputIndex];
        const [owner, _amount] = outputField;
        const amount = byteStringToInt(_amount);
        const txOut = this.txOutEntityRepository.create();
        txOut.txid = tx.hash;
        txOut.outputIndex = outputIndex;
        txOut.blockHeight = blockHeader ? blockHeader.height : 2147483647;
        txOut.satoshis = BigInt(output.satoshis);
        txOut.lockingScriptHash = lockingScriptHash;
        txOut.isFromMint = true;
        txOut.ownerPubKeyHash = sha256(owner);
        txOut.tokenAmount = amount;
        txOut.data = toHex(output.data);


        const tokenInfo = inputTokenInfos.find((m) => m.tokenScriptHash == lockingScriptHash);
        const backtraceValid = this.commonService.checkTokenBacktrace(txOut, tokenInfo, tx);

        if (backtraceValid) {
          // Use upsert() instead of save() for composite primary key (txid, outputIndex)
          // to avoid duplicate key errors when transaction is processed multiple times
          // See: https://github.com/typeorm/typeorm/issues/720
          promises.push(this.txOutEntityRepository.upsert(txOut, ['txid', 'outputIndex']));
        }
        if (
          backtraceValid &&
          outputTag.includes(CatTags.CAT721_TAG) && tokenInfo
        ) {
          const nftMetadataIndex = inputMetadatas.findIndex((m) => m?.type == 'NFT');
          const nftMetadata = inputMetadatas[nftMetadataIndex];
          if (nftMetadata) {
            const commitTxid = tx.inputs[nftMetadataIndex].prevTxId.toString('hex');

            // handle delegate content
            // if the content is empty and the delegate is not empty, it's a delegate content
            const isDelegate = nftMetadata.info.delegate?.length > 0 && !nftMetadata.info.contentBody
            const contentType = isDelegate ? Constants.CONTENT_TYPE_CAT721_DELEGATE_V1 : MetadataSerializer.decodeContenType(nftMetadata.info.contentType)
            const contentRaw = isDelegate ? Buffer.from(nftMetadata.info.delegate, 'hex') : Buffer.from(nftMetadata.info.contentBody, 'hex')


            const nftInfoEntity = this.nftInfoEntityRepository.create({
              collectionId: tokenInfo.tokenId,
              localId: amount,
              mintTxid: tx.hash,
              mintHeight: blockHeader ? blockHeader.height : 2147483647,
              commitTxid,
              metadata: nftMetadata.info.metadata,
              contentType: contentType,
              contentEncoding: nftMetadata.info.contentEncoding,
              contentRaw: contentRaw,
            });
            // Use upsert() instead of save() for composite primary key (collectionId, localId)
            // to avoid duplicate key errors when transaction is processed multiple times
            // See: https://github.com/typeorm/typeorm/issues/720
            promises.push(this.nftInfoEntityRepository.upsert(nftInfoEntity, ['collectionId', 'localId']));
          }
        }
      }
    }
    // save token mint
    await Promise.all(promises);
    return promises.length > 0;
  }

  private async processTransferTx(
    tx: Transaction,
    outputTags: string[][],
    blockHeader: BlockHeader | null,
    outputFields: string[][],
  ) {
    const promises: Promise<any>[] = [];
    const inputTokenInfos = await this.tokenInfoEntityRepository.find({
      where: {
        tokenScriptHash: In(tx.outputs.map((output) => sha256(output.script.toHex()))),
      },
    });

    for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
      const outputTag = outputTags[outputIndex];
      const output = tx.outputs[outputIndex];
      const lockingScriptHash = sha256(tx.outputs[outputIndex].script.toHex());
      const tokenInfo = inputTokenInfos.find((m) => m.tokenScriptHash == lockingScriptHash);
      if (outputTag.includes(CatTags.CAT20_TAG)) {
        const outputField = outputFields[outputIndex];
        const [owner, _amount] = outputField;
        const amount = byteStringToInt(_amount);
        const txOut = this.txOutEntityRepository.create();
        txOut.txid = tx.hash;
        txOut.outputIndex = outputIndex;
        txOut.blockHeight = blockHeader ? blockHeader.height : 2147483647;
        txOut.satoshis = BigInt(output.satoshis);
        txOut.lockingScriptHash = lockingScriptHash;
        txOut.isFromMint = false;
        txOut.ownerPubKeyHash = owner;
        txOut.tokenAmount = amount;
        txOut.data = toHex(output.data);
        const backtraceValid = this.commonService.checkTokenBacktrace(txOut, tokenInfo, tx);
        if (backtraceValid) {
          // Use upsert() instead of save() for composite primary key (txid, outputIndex)
          // to avoid duplicate key errors when transaction is processed multiple times
          // See: https://github.com/typeorm/typeorm/issues/720
          promises.push(this.txOutEntityRepository.upsert(txOut, ['txid', 'outputIndex']));
        }
      }
      if (outputTag.includes(CatTags.CAT721_TAG)) {
        const outputField = outputFields[outputIndex];
        const [owner, _localId] = outputField;
        const localId = byteStringToInt(_localId);
        const txOut = this.txOutEntityRepository.create();
        txOut.txid = tx.hash;
        txOut.outputIndex = outputIndex;
        txOut.blockHeight = blockHeader ? blockHeader.height : 2147483647;
        txOut.satoshis = BigInt(output.satoshis);
        txOut.lockingScriptHash = lockingScriptHash;
        txOut.isFromMint = false;
        txOut.ownerPubKeyHash = owner;
        txOut.tokenAmount = localId
        txOut.data = toHex(output.data);
        const backtraceValid = this.commonService.checkTokenBacktrace(txOut, tokenInfo, tx);
        if (backtraceValid) {
          // Use upsert() instead of save() for composite primary key (txid, outputIndex)
          // to avoid duplicate key errors when transaction is processed multiple times
          // See: https://github.com/typeorm/typeorm/issues/720
          promises.push(this.txOutEntityRepository.upsert(txOut, ['txid', 'outputIndex']));
        }
      }
    }
    await Promise.all(promises);
    return promises.length > 0;
  }

  /**
   * Delete tx in blocks with height greater than or equal to the given height
   */
  public async deleteTx(manager: EntityManager, height: number) {
    // txs to delete
    const txs = await this.txEntityRepository.find({
      select: ['txid'],
      where: { blockHeight: MoreThanOrEqual(height) },
    });
    const promises = [
      manager.delete(NftInfoEntity, {
        mintHeight: MoreThanOrEqual(height),
      }),
      manager.update(
        TokenInfoEntity,
        { firstMintHeight: MoreThanOrEqual(height) },
        { firstMintHeight: null, tokenScriptHash: null },
      ),
      manager.delete(TokenMintEntity, {
        blockHeight: MoreThanOrEqual(height),
      }),
      manager.delete(TxEntity, { blockHeight: MoreThanOrEqual(height) }),
      manager.delete(TxOutEntity, { blockHeight: MoreThanOrEqual(height) }),
      // reset spent status of tx outputs
      ...txs.map((tx) => {
        return manager.update(TxOutEntity, { spendTxid: tx.txid }, { spendTxid: null, spendInputIndex: null });
      }),
    ];
    if (txs.length > 0) {
      // Empty criteria(s) are not allowed for the delete method
      promises.push(
        manager.delete(
          TokenInfoEntity,
          txs.map((tx) => {
            return { genesisTxid: tx.txid };
          }),
        ),
      );
    }
    return Promise.all(promises);
  }

  @Cron('* * * * *')
  private async archiveTxOuts() {
    const startTime = Date.now();
    const lastProcessedHeight = await this.commonService.getLastProcessedBlockHeight();
    if (lastProcessedHeight === null) {
      return;
    }
    const txOuts = await this.dataSource.manager
      .createQueryBuilder('tx_out', 'txOut')
      .innerJoin('tx', 'tx', 'txOut.spend_txid = tx.txid')
      .where('txOut.spend_txid IS NOT NULL')
      .andWhere('tx.block_height < :blockHeight', {
        blockHeight: lastProcessedHeight - 2880, // blocks before one day ago
      })
      .limit(1000) // archive no more than 1000 records once a time
      .getMany();
    if (txOuts.length === 0) {
      return;
    }
    await this.dataSource.transaction(async (manager) => {
      await Promise.all([
        manager.save(TxOutArchiveEntity, txOuts),
        manager.delete(
          TxOutEntity,
          txOuts.map((txOut) => {
            return { txid: txOut.txid, outputIndex: txOut.outputIndex };
          }),
        ),
      ]);
    });
    this.logger.log(`archived ${txOuts.length} outs in ${Math.ceil(Date.now() - startTime)} ms`);
  }
}
