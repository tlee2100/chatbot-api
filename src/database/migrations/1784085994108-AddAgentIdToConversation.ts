import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentIdToConversation1784085994108 implements MigrationInterface {
  name = 'AddAgentIdToConversation1784085994108';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" ADD "agentId" integer`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_6bc9cd21e9dad29f3de7b6da4d9" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_6bc9cd21e9dad29f3de7b6da4d9"`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "agentId"`);
  }
}
