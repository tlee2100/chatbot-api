import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiChatbotFeatures1784269829776 implements MigrationInterface {
  name = 'AddAiChatbotFeatures1784269829776';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "isAiActive" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."chat_messages_sendertype_enum" RENAME TO "chat_messages_sendertype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_messages_sendertype_enum" AS ENUM('VISITOR', 'AGENT', 'AI')`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ALTER COLUMN "senderType" TYPE "public"."chat_messages_sendertype_enum" USING "senderType"::"text"::"public"."chat_messages_sendertype_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."chat_messages_sendertype_enum_old"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "lastActivityAt"`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "lastActivityAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "lastActivityAt"`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD "lastActivityAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_messages_sendertype_enum_old" AS ENUM('VISITOR', 'AGENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ALTER COLUMN "senderType" TYPE "public"."chat_messages_sendertype_enum_old" USING "senderType"::"text"::"public"."chat_messages_sendertype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."chat_messages_sendertype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."chat_messages_sendertype_enum_old" RENAME TO "chat_messages_sendertype_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "isAiActive"`);
  }
}
