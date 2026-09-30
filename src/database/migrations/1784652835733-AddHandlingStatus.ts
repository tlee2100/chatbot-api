import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHandlingStatus1784652835733 implements MigrationInterface {
  name = 'AddHandlingStatus1784652835733';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."conversations_handlingstatus_enum" AS ENUM('AI_HANDLING', 'WAITING_FOR_AGENT', 'AGENT_HANDLING')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "handlingStatus" "public"."conversations_handlingstatus_enum" NOT NULL DEFAULT 'AI_HANDLING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "handlingStatus"`);
    await queryRunner.query(`DROP TYPE "public"."conversations_handlingstatus_enum"`);
  }
}
