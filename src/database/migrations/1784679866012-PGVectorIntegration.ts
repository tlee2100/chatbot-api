import { MigrationInterface, QueryRunner } from 'typeorm';

export class PGVectorIntegration1784679866012 implements MigrationInterface {
  name = 'PGVectorIntegration1784679866012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(
      `CREATE TABLE "document_chunks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "documentId" integer NOT NULL, "siteId" integer NOT NULL, "chunkIndex" integer NOT NULL, "content" text NOT NULL, "embedding" vector(1536) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c90b1c98cb81b5afb15defb972f" UNIQUE ("documentId", "chunkIndex"), CONSTRAINT "PK_7f9060084e9b872dbb567193978" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_70fc0924c404424d5dce7e432f" ON "document_chunks" ("siteId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_embedding_hnsw" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops)`,
    );
    await queryRunner.query(`ALTER TABLE "chat_messages" ADD "knowledgeSources" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "document_chunks" ADD CONSTRAINT "FK_eaf9afaf30fb7e2ac25989db51b" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_chunks" ADD CONSTRAINT "FK_70fc0924c404424d5dce7e432f1" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_chunks" DROP CONSTRAINT "FK_70fc0924c404424d5dce7e432f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_chunks" DROP CONSTRAINT "FK_eaf9afaf30fb7e2ac25989db51b"`,
    );
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "knowledgeSources"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_embedding_hnsw"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_70fc0924c404424d5dce7e432f"`);
    await queryRunner.query(`DROP TABLE "document_chunks"`);
  }
}
