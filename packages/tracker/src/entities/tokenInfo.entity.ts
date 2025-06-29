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
}
