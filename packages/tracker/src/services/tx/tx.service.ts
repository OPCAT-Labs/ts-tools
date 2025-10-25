import { Injectable, Logger } from '@nestjs/common';
import { TxEntity } from '../../entities/tx.entity';
import { DataSource, EntityManager, MoreThanOrEqual, Repository } from 'typeorm';
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
import { byteString2Int, sha256, toHex } from 'scrypt-ts';
import { ContractLib } from '../../common/contract';
import { RpcService } from '../rpc/rpc.service';
import { ZmqService } from '../zmq/zmq.service';
import { uint8ArrayToHex } from '@cat-protocol/cat-sdk-v2';

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

  async txAddPrevouts(tx: Transaction) {
    for (const input of tx.inputs) {
      const prevTxid = input.prevTxId.toString('hex');
      const outputIndex = input.outputIndex;
      const resp = await this.rpcService.getRawTx(prevTxid);
      const preTx = new Transaction(resp?.data?.result);
      input.output = preTx.outputs[outputIndex];
    }
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

      await this.txAddPrevouts(tx);
      // get tags
      const inputTags = ContractLib.decodeInputsTag(tx);
      const outputTags = ContractLib.decodeOutputsTag(tx);
      const outputFields = ContractLib.decodeAllOutputFields(tx);
      const tags = inputTags.concat(outputTags);
      let isSaveTx = false;
      if (inputTags[0] === ContractLib.OPCAT_METADATA_TAG) {
        // process genesis
        isSaveTx = isSaveTx || (await this.processMetaTx(tx, outputTags, blockHeader));
        this.logger.log(`[OK] genesis tx ${tx.id}`);
      }
      //
      if (inputTags[0] === ContractLib.OPCAT_MINTER_TAG) {
        // search minter in inputs
        isSaveTx = isSaveTx || (await this.processMintTx(tx, outputTags, blockHeader, outputFields));
        this.logger.log(`[OK] mint tx ${tx.id}`);
      }
      //
      if (tags.includes(ContractLib.OPCAT_CAT20_TAG)) {
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

  private async processMetaTx(tx: Transaction, outputTags: string[], blockHeader: BlockHeader | null) {
    const promises: Promise<any>[] = [];
    const input = tx.inputs[0];
    const inputGenesis = input.output;
    const fields = ContractLib.decodeFields(inputGenesis.data);
    const tokenId = `${input.prevTxId.toString('hex')}_${input.outputIndex}`;
    const [, _name, _symbol, _decimals] = fields;
    const name = Buffer.from(_name, 'hex').toString('utf-8');
    const symbol = Buffer.from(_symbol, 'hex').toString('utf-8');
    const decimals = Number(byteString2Int(_decimals));
    const tokenInfoEntity = this.tokenInfoEntityRepository.create({
      tokenId,
      genesisTxid: tx.hash,
      name: name,
      symbol: symbol,
      decimals: decimals,
      rawInfo: toHex(inputGenesis.data),
    });
    let adminScriptHash = sha256('');
    const adminIndex = outputTags.findIndex(tag => tag === ContractLib.OPCAT_CAT20_ADMIN_TAG);
    if (adminIndex !== -1 && tx.outputs.length > adminIndex) {
      adminScriptHash = sha256(tx.outputs[adminIndex].script.toHex());
    }
    // promises.push(p);
    for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
      const output = tx.outputs[outputIndex];
      const outputTag = outputTags[outputIndex];
      const lockingScriptHash = sha256(tx.outputs[outputIndex].script.toHex());
      if (outputTag === ContractLib.OPCAT_MINTER_TAG) {
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
        promises.push(this.txOutEntityRepository.save(txOut));
      }
    }
    promises.push(this.tokenInfoEntityRepository.save(tokenInfoEntity));
    await Promise.all(promises);
    return promises.length > 0;
  }

  private async processMintTx(
    tx: Transaction,
    outputTags: string[],
    blockHeader: BlockHeader | null,
    outputFields: string[][],
  ) {
    const promises: Promise<any>[] = [];
    const inputMinter = await this.tokenInfoEntityRepository.findOne({
      where: {
        minterScriptHash: sha256(tx.inputs[0].output.script.toHex()),
      },
    });
    for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
      const outputTag = outputTags[outputIndex];
      const output = tx.outputs[outputIndex];
      const lockingScriptHash = sha256(tx.outputs[outputIndex].script.toHex());
      if (outputTag === ContractLib.OPCAT_MINTER_TAG) {
        const txOut = this.txOutEntityRepository.create();
        txOut.txid = tx.hash;
        txOut.outputIndex = outputIndex;
        txOut.blockHeight = blockHeader ? blockHeader.height : 2147483647;
        txOut.satoshis = BigInt(output.satoshis);
        txOut.lockingScriptHash = lockingScriptHash;
        txOut.isFromMint = true;
        txOut.tokenAmount = 0n;
        txOut.data = toHex(output.data);
        promises.push(this.txOutEntityRepository.save(txOut));
      } else if (outputTag === ContractLib.OPCAT_CAT20_TAG) {
        if (!inputMinter.tokenScriptHash) {
          inputMinter.tokenScriptHash = lockingScriptHash;
          promises.push(this.tokenInfoEntityRepository.save(inputMinter));
        }
        const outputField = outputFields[outputIndex];
        const [, owner, _amount] = outputField;
        const amount = byteString2Int(_amount);
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
        promises.push(this.txOutEntityRepository.save(txOut));
      }
    }
    // save token mint
    await Promise.all(promises);
    return promises.length > 0;
  }

  private async processTransferTx(
    tx: Transaction,
    outputTags: string[],
    blockHeader: BlockHeader | null,
    outputFields: string[][],
  ) {
    const promises: Promise<any>[] = [];
    for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
      const outputTag = outputTags[outputIndex];
      const output = tx.outputs[outputIndex];
      const lockingScriptHash = sha256(tx.outputs[outputIndex].script.toHex());
      if (outputTag === ContractLib.OPCAT_CAT20_TAG) {
        // Todo
        const outputField = outputFields[outputIndex];
        const [, owner, _amount] = outputField;
        const amount = byteString2Int(_amount);
        const txOut = this.txOutEntityRepository.create();
        txOut.txid = tx.hash;
        txOut.outputIndex = outputIndex;
        txOut.blockHeight = blockHeader ? blockHeader.height : 2147483647;
        txOut.satoshis = BigInt(output.satoshis);
        txOut.lockingScriptHash = lockingScriptHash;
        txOut.isFromMint = false;
        txOut.ownerPubKeyHash = sha256(owner);
        txOut.tokenAmount = amount;
        txOut.data = toHex(output.data);
        promises.push(this.txOutEntityRepository.save(txOut));
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

  private buildBaseTxOutEntity(tx: Transaction, outputIndex: number, blockHeader: BlockHeader) {
    return {
      txid: tx.id,
      outputIndex,
      blockHeight: blockHeader.height,
      satoshis: BigInt(tx.outputs[outputIndex].satoshis),
      lockingScriptHash: sha256(tx.outputs[outputIndex].script.toHex()),
    };
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
