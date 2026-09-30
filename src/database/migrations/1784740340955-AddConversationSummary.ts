import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationSummary1784740340955 implements MigrationInterface {
  name = 'AddConversationSummary1784740340955';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" ADD "summary" text`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "summarizedMessageCount" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "summarizedMessageCount"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "summary"`);
  }
}
