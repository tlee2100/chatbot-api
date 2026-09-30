import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnhancedChatFeatures1784165732612 implements MigrationInterface {
  name = 'AddEnhancedChatFeatures1784165732612';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_messages" ADD "reactions" jsonb DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "chat_messages" ADD "fileUrl" character varying`);
    await queryRunner.query(`ALTER TABLE "chat_messages" ADD "fileName" character varying`);
    await queryRunner.query(`ALTER TABLE "chat_messages" ADD "fileType" character varying`);
    await queryRunner.query(
      `CREATE TYPE "public"."chat_messages_status_enum" AS ENUM('SENT', 'DELIVERED', 'READ')`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "status" "public"."chat_messages_status_enum" NOT NULL DEFAULT 'SENT'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."conversations_status_enum" RENAME TO "conversations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversations_status_enum" AS ENUM('OPEN', 'PAUSED', 'CLOSED')`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "status" TYPE "public"."conversations_status_enum" USING "status"::"text"::"public"."conversations_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" ALTER COLUMN "status" SET DEFAULT 'OPEN'`);
    await queryRunner.query(`DROP TYPE "public"."conversations_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."conversations_status_enum_old" AS ENUM('OPEN', 'CLOSED')`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "status" TYPE "public"."conversations_status_enum_old" USING "status"::"text"::"public"."conversations_status_enum_old"`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" ALTER COLUMN "status" SET DEFAULT 'OPEN'`);
    await queryRunner.query(`DROP TYPE "public"."conversations_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."conversations_status_enum_old" RENAME TO "conversations_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "fileType"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "fileName"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "fileUrl"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "reactions"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."chat_messages_status_enum"`);
  }
}
