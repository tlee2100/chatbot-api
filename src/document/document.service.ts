import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import type { Queue } from 'bull';
import { paginate, PaginateQuery, Paginated } from 'nestjs-paginate';
import { unlink } from 'fs/promises';
import { Role } from 'src/user/enums/role.enum';
import { SiteService } from '../site/site.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Document } from './entities/document.entity';
import { DocumentStatus } from './enums/document-status.enum';
import { VectorStoreService } from '../vector-store/vector-store.service';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectQueue('document-processing')
    private readonly documentQueue: Queue,
    private readonly siteService: SiteService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  async uploadAndQueue(
    file: Express.Multer.File,
    siteId: number,
    currentUserId: number,
    currentUserRole: Role,
  ): Promise<Document> {
    const site = await this.siteService.assertSiteAccess(siteId, currentUserId, currentUserRole);

    const document = this.documentRepository.create({
      filename: file.originalname,
      filePath: file.path,
      siteId,
      status: DocumentStatus.PENDING,
    });
    const savedDocument = await this.documentRepository.save(document);

    await this.documentQueue.add('process-document', {
      documentId: savedDocument.id,
      filePath: savedDocument.filePath,
    });

    // Thông báo cho Owner và Agents của site
    const userIdsToNotify = new Set([site.ownerId]);
    if (site.agents) {
      site.agents.forEach((agent) => userIdsToNotify.add(agent.id));
    }

    this.notificationsGateway.notifyUsers(Array.from(userIdsToNotify), {
      title: 'Tài liệu mới',
      message: `Tài liệu "${file.originalname}" đã được tải lên cho site ${site.name}`,
      type: 'document.uploaded',
    });

    return savedDocument;
  }

  async findOne(id: number): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: ['site'],
    });
    if (!document) {
      throw new NotFoundException(`Document with id ${id} not found`);
    }
    return document;
  }

  async findAll(
    query: PaginateQuery,
    currentUserId: number,
    currentUserRole: Role,
  ): Promise<Paginated<Document>> {
    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.site', 'site');

    switch (currentUserRole) {
      case Role.SUPER_ADMIN:
        break;

      case Role.ADMIN:
        queryBuilder.andWhere('site.ownerId = :ownerId', { ownerId: currentUserId });
        break;

      case Role.AGENT:
        queryBuilder.andWhere(
          'site.id IN (SELECT sa."siteId" FROM site_agents sa WHERE sa."agentId" = :agentId)',
          { agentId: currentUserId },
        );
        break;

      default: {
        const exhaustiveCheck: never = currentUserRole;
        throw new ForbiddenException(
          `Role "${String(exhaustiveCheck)}" is not permitted to list documents`,
        );
      }
    }

    return paginate(query, queryBuilder, {
      sortableColumns: ['id', 'filename', 'status', 'uploadedAt'],
      defaultSortBy: [['uploadedAt', 'DESC']],
      filterableColumns: {
        siteId: true,
        status: true,
      },
    });
  }

  async findAllBySite(siteId: number): Promise<Document[]> {
    return this.documentRepository.find({ where: { siteId } });
  }

  async updateStatus(id: number, status: DocumentStatus): Promise<Document> {
    await this.documentRepository.update(id, {
      status,
      processedAt: status === DocumentStatus.READY ? new Date() : undefined,
    });
    return this.findOne(id);
  }

  async remove(id: number, currentUserId: number, currentUserRole: Role): Promise<void> {
    if (currentUserRole === Role.AGENT) {
      throw new ForbiddenException('Agents are not permitted to delete documents');
    }

    const document = await this.findOne(id);

    // Verify site access before deleting
    await this.siteService.assertSiteAccess(document.siteId, currentUserId, currentUserRole);

    try {
      await unlink(document.filePath);
    } catch (e) {
      console.warn(`Could not delete file ${document.filePath}:`, e);
    }

    await this.vectorStoreService.deleteDocuments(id);

    await this.documentRepository.remove(document);
  }
}
