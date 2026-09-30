import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatEntities1784018757896 implements MigrationInterface {
  name = 'AddChatEntities1784018757896';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."chat_messages_sendertype_enum" AS ENUM('VISITOR', 'AGENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "senderType" "public"."chat_messages_sendertype_enum" NOT NULL, "agentId" integer, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversations_status_enum" AS ENUM('OPEN', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "siteId" integer NOT NULL, "visitorName" character varying NOT NULL, "visitorEmail" character varying NOT NULL, "status" "public"."conversations_status_enum" NOT NULL DEFAULT 'OPEN', "lastActivityAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sites" ADD "themeColor" character varying DEFAULT '#0066FF'`,
    );
    await queryRunner.query(`ALTER TABLE "sites" ADD "logoUrl" character varying`);
    await queryRunner.query(
      `ALTER TABLE "sites" ADD "welcomeMessage" character varying DEFAULT 'Hi there! How can we help you today?'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_45745953065384cc9c4264c2a3d" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_9ca4bc1e292d114267270f916c2" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_99acf7e1bd2c25211aa7bda3477" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_99acf7e1bd2c25211aa7bda3477"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_9ca4bc1e292d114267270f916c2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_45745953065384cc9c4264c2a3d"`,
    );
    await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN "welcomeMessage"`);
    await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN "logoUrl"`);
    await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN "themeColor"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TYPE "public"."conversations_status_enum"`);
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TYPE "public"."chat_messages_sendertype_enum"`);
  }
}
