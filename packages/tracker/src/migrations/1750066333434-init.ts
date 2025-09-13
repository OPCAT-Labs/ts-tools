import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1750066333434 implements MigrationInterface {
  name = 'Init1750066333434';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tx_out_archive" ("txid" character varying(64) NOT NULL, "output_index" integer NOT NULL, "block_height" integer NOT NULL, "satoshis" bigint NOT NULL, "locking_script" character varying NOT NULL, "xonly_pubkey" character varying, "owner_pkh" character varying, "token_amount" bigint, "spend_txid" character varying, "spend_input_index" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_80e1532f0cc61b9408923c710d3" PRIMARY KEY ("txid", "output_index"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tx" ("txid" character varying(64) NOT NULL, "block_height" integer NOT NULL, "tx_index" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e5bf84e0e897ce668b82ca3f833" PRIMARY KEY ("txid"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_dda1249bcfce884c26070b1f96" ON "tx" ("block_height") `);
    await queryRunner.query(
      `CREATE TABLE "token_mint" ("txid" character varying(64) NOT NULL, "token_pubkey" character varying(64) NOT NULL, "block_height" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_21865bb90d676d5e24693eccf55" PRIMARY KEY ("txid"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_630181ee96ff88d9341cebdaae" ON "token_mint" ("block_height") `);
    await queryRunner.query(`CREATE INDEX "IDX_6cda73ea74baf9ce0a3e51db23" ON "token_mint" ("token_pubkey") `);
    await queryRunner.query(
      `CREATE TABLE "tx_out" ("txid" character varying(64) NOT NULL, "output_index" integer NOT NULL, "block_height" integer NOT NULL, "satoshis" bigint NOT NULL, "locking_script_hash" character varying NOT NULL, "owner_pkh" character varying, "token_amount" bigint, "state_hash" character varying, "spend_txid" character varying, "spend_input_index" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "update_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bf339c207c55632c1b44cb4dcce" PRIMARY KEY ("txid", "output_index"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_842a85dd927879c12574bc8c23" ON "tx_out" ("block_height") `);
    await queryRunner.query(`CREATE INDEX "IDX_86da4cbf17aa7cdc2ae2e1fc9b" ON "tx_out" ("owner_pkh") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bfb80f86207bfba4dcfdba8406" ON "tx_out" ("locking_script_hash", "owner_pkh") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4bb884940e61aa867fc229d5da" ON "tx_out" ("spend_txid", "spend_input_index") `,
    );
    await queryRunner.query(
      `CREATE TABLE "token_info" ("token_id" character varying NOT NULL, "genesis_txid" character varying NOT NULL, "name" character varying NOT NULL, "symbol" character varying NOT NULL, "decimals" integer NOT NULL, "raw_info" jsonb NOT NULL, "content_type" character varying, "content_encoding" character varying, "content_raw" bytea, "minter_pubkey" character varying(64) NOT NULL, "token_pubkey" character varying(64), "first_mint_height" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_84c0d8366cd8317811709c9e3f4" PRIMARY KEY ("token_id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_c22e5423743e6c29055aee529b" ON "token_info" ("genesis_txid") `);
    await queryRunner.query(`CREATE INDEX "IDX_7bed7ff4597424517e6199af07" ON "token_info" ("minter_pubkey") `);
    await queryRunner.query(`CREATE INDEX "IDX_1f0d5f053ec979babce24f626b" ON "token_info" ("token_pubkey") `);
    await queryRunner.query(`CREATE INDEX "IDX_899a44411763b33029cd4231cd" ON "token_info" ("first_mint_height") `);
    await queryRunner.query(
      `CREATE TABLE "nft_info" ("collection_id" character varying NOT NULL, "local_id" bigint NOT NULL, "mint_txid" character varying(64) NOT NULL, "mint_height" integer NOT NULL, "commit_txid" character varying(64) NOT NULL, "metadata" jsonb, "content_type" character varying, "content_encoding" character varying, "content_raw" bytea, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e1eaf4029498024bfc744325bb8" PRIMARY KEY ("collection_id", "local_id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_43f2d6d3ac593d8a883d14d3a9" ON "nft_info" ("mint_txid") `);
    await queryRunner.query(`CREATE INDEX "IDX_d7adb9bb7a79091f94373b43e9" ON "nft_info" ("mint_height") `);
    await queryRunner.query(
      `CREATE TABLE "block" ("hash" character varying(64) NOT NULL, "height" integer NOT NULL, "n_tx" integer NOT NULL DEFAULT '0', "time" integer NOT NULL, "previous_hash" character varying(64), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f8fba63d7965bfee9f304c487aa" PRIMARY KEY ("hash"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_bce676e2b005104ccb768495db" ON "block" ("height") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_bce676e2b005104ccb768495db"`);
    await queryRunner.query(`DROP TABLE "block"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d7adb9bb7a79091f94373b43e9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_43f2d6d3ac593d8a883d14d3a9"`);
    await queryRunner.query(`DROP TABLE "nft_info"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_899a44411763b33029cd4231cd"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1f0d5f053ec979babce24f626b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7bed7ff4597424517e6199af07"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c22e5423743e6c29055aee529b"`);
    await queryRunner.query(`DROP TABLE "token_info"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4bb884940e61aa867fc229d5da"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bfb80f86207bfba4dcfdba8406"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_86da4cbf17aa7cdc2ae2e1fc9b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_842a85dd927879c12574bc8c23"`);
    await queryRunner.query(`DROP TABLE "tx_out"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6cda73ea74baf9ce0a3e51db23"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_630181ee96ff88d9341cebdaae"`);
    await queryRunner.query(`DROP TABLE "token_mint"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_dda1249bcfce884c26070b1f96"`);
    await queryRunner.query(`DROP TABLE "tx"`);
    await queryRunner.query(`DROP TABLE "tx_out_archive"`);
  }
}
