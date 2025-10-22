import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('token_info')
export class TokenInfoEntity {
  @PrimaryColumn({ name: 'token_id' })
  tokenId: string;

  @Column({ name: 'genesis_txid' })
  @Index()
  genesisTxid: string;

  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column()
  decimals: number;

  @Column({ name: 'raw_info' })
  rawInfo: string;

  @Column({ name: 'minter_script_hash', length: 64, nullable: true })
  @Index()
  minterScriptHash: string;

  @Column({ name: 'token_script_hash', length: 64, nullable: true })
  @Index()
  tokenScriptHash: string;

  @Column({ name: 'first_mint_height', nullable: true })
  @Index()
  firstMintHeight: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'holders_num', nullable: true })
  holdersNum: number;

  @Column({ name: 'total_trans_num', nullable: true })
  totalTransNum: number;

  @Column({ name: 'premine', nullable: true })
  premine: number;

  @Column({ name: 'token_limit', nullable: true })
  tokenLimit: number;

  @Column({ name: 'minted', nullable: true })
  minted: number;

  @Column({ name: 'supply', nullable: true })
  supply: number;

  @Column({ name: 'deploy_block', nullable: true })
  deployBlock: number;

  @Column({ name: 'deploy_txid', nullable: true })
  deployTxid: string;

  @Column({ name: 'reveal_txid', nullable: true })
  revealTxid: string;

  @Column({ name: 'deploy_time', nullable: true })
  deployTime: Date;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl: string;

}
