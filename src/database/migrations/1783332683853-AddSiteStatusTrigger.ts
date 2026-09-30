import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSiteStatusTrigger1783330000000 implements MigrationInterface {
  name = 'AddSiteStatusTrigger1783330000000'; // 👈 sửa đúng khớp timestamp trong tên file

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_site_knowledge_base_status()
      RETURNS TRIGGER AS $$
      DECLARE
        target_site_id INTEGER;
        total_docs INTEGER;
        ready_docs INTEGER;
        processing_docs INTEGER;
        new_status TEXT;
      BEGIN
        IF (TG_OP = 'DELETE') THEN
          target_site_id := OLD."siteId";
        ELSE
          target_site_id := NEW."siteId";
        END IF;

        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE status = 'ready'),
               COUNT(*) FILTER (WHERE status = 'processing')
        INTO total_docs, ready_docs, processing_docs
        FROM documents
        WHERE "siteId" = target_site_id;

        IF total_docs = 0 THEN
          new_status := 'pending';
        ELSIF ready_docs = total_docs THEN
          new_status := 'ready';
        ELSIF processing_docs > 0 THEN
          new_status := 'processing';
        ELSE
          new_status := 'pending';
        END IF;

        UPDATE sites
        SET "knowledgeBaseStatus" = new_status::sites_knowledgebasestatus_enum
        WHERE id = target_site_id;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trigger_update_site_status ON documents;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_update_site_status
      AFTER INSERT OR UPDATE OF status OR DELETE ON documents
      FOR EACH ROW
      EXECUTE FUNCTION update_site_knowledge_base_status();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_update_site_status ON documents;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_site_knowledge_base_status();`);
  }
}
