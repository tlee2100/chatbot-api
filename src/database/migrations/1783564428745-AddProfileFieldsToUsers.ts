import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileFieldsToUsers1783564428745 implements MigrationInterface {
  name = 'AddProfileFieldsToUsers1783564428745';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" character varying(300)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "avatarUrl" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
  }
}
