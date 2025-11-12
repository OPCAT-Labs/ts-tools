import { Injectable, Logger } from '@nestjs/common';
import { RpcService } from '../rpc/rpc.service';
import { BlockEntity } from '../../entities/block.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CAT20Guard_12_12_2, CAT20Guard_12_12_4, CAT20Guard_6_6_2, CAT20Guard_6_6_4, CAT20GuardPeripheral, CAT721Guard_12_12_2, CAT721Guard_12_12_4, CAT721Guard_6_6_2, CAT721Guard_6_6_4, CAT721GuardPeripheral, CatTags, ContractPeripheral } from '@opcat-labs/cat-sdk';
import { Input, Transaction } from '@opcat-labs/opcat';
import { TxOutEntity } from 'src/entities/txOut.entity';
import { TokenInfoEntity } from 'src/entities/tokenInfo.entity';
import { ABICoder, ABIEntityType, ContractHeaderSerializer, sha256 } from '@opcat-labs/scrypt-ts-opcat';

@Injectable()
export class CommonService {
  private readonly logger = new Logger(CommonService.name);

  public readonly FT_GUARD_SCRIPT_HASHES: string[];
  public readonly NFT_GUARD_SCRIPT_HASHES: string[];

  constructor(
    private readonly rpcService: RpcService,
    @InjectRepository(BlockEntity)
    private blockEntityRepository: Repository<BlockEntity>,
  ) {
    // Initialize all FT guard script hashes
    this.FT_GUARD_SCRIPT_HASHES = CAT20GuardPeripheral.getGuardScriptHashes();
    this.logger.log(`token guard script hashes = ${this.FT_GUARD_SCRIPT_HASHES.join(', ')}`);

    // Initialize all NFT guard script hashes
    this.NFT_GUARD_SCRIPT_HASHES = CAT721GuardPeripheral.getGuardScriptHashes();
    this.logger.log(`nft guard script hashes = ${this.NFT_GUARD_SCRIPT_HASHES.join(', ')}`);
  }

  public async getLastProcessedBlock(): Promise<BlockEntity | null> {
    const blocks = await this.blockEntityRepository.find({
      take: 1,
      order: { height: 'DESC' },
    });
    return blocks[0] || null;
  }

  public async getLastProcessedBlockHeight(): Promise<number | null> {
    const block = await this.getLastProcessedBlock();
    return block?.height || null;
  }

  public async getBlockchainInfo() {
    const resp = await this.rpcService.getBlockchainInfo();
    return resp?.data?.result;
  }

  /**
   * Parse token outputs from guard input of a transfer tx
   * @param guardInput the cat20 guard input
   * @returns Map of token outputs: output index -> { ownerPubKeyHash, tokenAmount }
   */
  public parseTransferTxCAT20Outputs(guardInput: Input): Map<number, { ownerPubKeyHash: string, tokenAmount: bigint }> {
    const guardInputScript = guardInput.script.toHex()
    const guardTags = ContractHeaderSerializer.deserialize(guardInput.output.script.toHex()).header?.tags || [];
    if (!guardTags.includes(CatTags.CAT20_GUARD_TAG)) {
      throw new Error('not a CAT20 guard input');
    }
    let abi: ABICoder;
    if (guardTags.includes(CatTags.CAT20_GUARD_6_6_2_TAG)) {
      abi = new ABICoder(CAT20Guard_6_6_2.artifact);
    } else if (guardTags.includes(CatTags.CAT20_GUARD_6_6_4_TAG)) {
      abi = new ABICoder(CAT20Guard_6_6_4.artifact);
    } else if (guardTags.includes(CatTags.CAT20_GUARD_12_12_2_TAG)) {
      abi = new ABICoder(CAT20Guard_12_12_2.artifact);
    } else if (guardTags.includes(CatTags.CAT20_GUARD_12_12_4_TAG)) {
      abi = new ABICoder(CAT20Guard_12_12_4.artifact);
    } else {
      throw new Error('unsupported CAT20 guard version');
    }
    const decoded = abi.decodePubFunctionCall(guardInputScript);
    const methodAbi = abi.artifact.abi.find(abi => abi.name === 'unlock' && abi.type === ABIEntityType.FUNCTION);
    if (decoded.method !== methodAbi?.name) {
      throw new Error('not a CAT20 guard input');
    }
    if (decoded.args.length !== methodAbi?.params?.length) {
      throw new Error('invalid CAT20 guard input');
    }

    const ownerAddrOrScriptHashes: string[] = decoded.args[1].value as string[];
    const outputTokens: bigint[] = decoded.args[2].value as bigint[];

    const tokenOutputs = new Map<
      number,
      {
        ownerPubKeyHash: string;
        tokenAmount: bigint;
      }
    >();
    outputTokens.forEach((tokenAmount, index) => {
      if (tokenAmount > 0n) {
        tokenOutputs.set(index, {
          ownerPubKeyHash: ownerAddrOrScriptHashes[index],
          tokenAmount: tokenAmount,
        });
      }
    });
    return tokenOutputs;
  }

  /**
   * Parse nft outputs from guard input of a transfer tx
   * @param guardInput the cat721 guard input
   * @returns Map of nft outputs: output index -> { ownerPubKeyHash, localId }
   */
  public parseTransferTxCAT721Outputs(guardInput: Input): Map<number, { ownerPubKeyHash: string, localId: bigint }> {
    const guardInputScript = guardInput.script.toHex()
    const guardTags = ContractHeaderSerializer.deserialize(guardInput.output.script.toHex()).header?.tags || [];
    if (!guardTags.includes(CatTags.CAT721_GUARD_TAG)) {
      throw new Error('not a CAT721 guard input');
    }
    let abi: ABICoder;
    if (guardTags.includes(CatTags.CAT721_GUARD_6_6_2_TAG)) {
      abi = new ABICoder(CAT721Guard_6_6_2.artifact);
    } else if (guardTags.includes(CatTags.CAT721_GUARD_6_6_4_TAG)) {
      abi = new ABICoder(CAT721Guard_6_6_4.artifact);
    } else if (guardTags.includes(CatTags.CAT721_GUARD_12_12_2_TAG)) {
      abi = new ABICoder(CAT721Guard_12_12_2.artifact);
    } else if (guardTags.includes(CatTags.CAT721_GUARD_12_12_4_TAG)) {
      abi = new ABICoder(CAT721Guard_12_12_4.artifact);
    } else {
      throw new Error('unsupported CAT721 guard version');
    }
    const decoded = abi.decodePubFunctionCall(guardInputScript);
    const methodAbi = abi.artifact.abi.find(abi => abi.name === 'unlock' && abi.type === ABIEntityType.FUNCTION);
    if (decoded.method !== methodAbi?.name) {
      throw new Error('not a CAT721 guard input');
    }
    if (decoded.args.length !== methodAbi?.params?.length) {
      throw new Error('invalid CAT721 guard input');
    }

    const ownerAddrOrScriptHashes: string[] = decoded.args[1].value as string[];
    const outputLocalIds: bigint[] = decoded.args[2].value as bigint[];

    const nftOutputs = new Map<
      number,
      {
        ownerPubKeyHash: string;
        localId: bigint;
      }
    >();
    outputLocalIds.forEach((localId, index) => {
      if (localId >= 0n) {
        nftOutputs.set(index, {
          ownerPubKeyHash: ownerAddrOrScriptHashes[index],
          localId: localId,
        });
      }
    });
    return nftOutputs;
  }

  /**
   * Search Guard in tx inputs
   * @returns array of Guard inputs
   */
  public searchGuardInputs(guardInputs: Input[]): Input[] {
    return guardInputs.filter((guardInput) => {
      const scriptHash = ContractPeripheral.scriptHash(guardInput.output.script.toHex());
      return this.FT_GUARD_SCRIPT_HASHES.includes(scriptHash) ||
        this.NFT_GUARD_SCRIPT_HASHES.includes(scriptHash);
    });
  }

  public isFungibleGuard(guardInput: Input): boolean {
    const scriptHash = ContractPeripheral.scriptHash(guardInput.output.script.toHex());
    return this.FT_GUARD_SCRIPT_HASHES.includes(scriptHash);
  }

  public async getRawTx(txid: string, verbose: boolean = false): Promise<string | undefined> {
    const resp = await this.rpcService.getRawTx(txid, verbose);
    return resp?.data?.result;
  }

  checkMinterBacktrace(
    txOut: TxOutEntity,
    tokenInfo: TokenInfoEntity,
    tx: Transaction
  ) {
    const txPrevouts = tx.inputs.map((input) => {
      const prevTxid = input.prevTxId.toString('hex');
      const outputIndex = input.outputIndex;
      return `${prevTxid}_${outputIndex}`;
    })
    const txPrevScriptHashes = this.getInputScriptHashes(tx);
    const prevHasScriptHash = txPrevScriptHashes.includes(txOut.lockingScriptHash);
    if (prevHasScriptHash) return true;
    const prevHasTokenId = tokenInfo && txPrevouts.includes(tokenInfo.tokenId);
    return prevHasTokenId
  }

  checkTokenBacktrace(
    txOut: TxOutEntity,
    tokenInfo: TokenInfoEntity,
    tx: Transaction
  ) {
    const txPrevScriptHashes = this.getInputScriptHashes(tx);
    const prevHasTokenScriptHash = txPrevScriptHashes.includes(txOut.lockingScriptHash);
    const prevHasMinterScriptHash = tokenInfo && txPrevScriptHashes.includes(tokenInfo.minterScriptHash);
    return prevHasTokenScriptHash || prevHasMinterScriptHash;
  }

  private getInputScriptHashes(tx: Transaction): string[] {
    return tx.inputs.map((input) => {
      const script = input.output.script.toHex();
      return sha256(script);
    });
  }

  async txAddPrevouts(tx: Transaction) {
    for (const input of tx.inputs) {
      const prevTxid = input.prevTxId.toString('hex');
      const outputIndex = input.outputIndex;
      const resp = await this.getRawTx(prevTxid, true);
      const preTx = new Transaction(resp['hex']);
      input.output = preTx.outputs[outputIndex];
    }
  }
}
