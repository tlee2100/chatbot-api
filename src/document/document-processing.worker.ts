import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import * as fs from 'fs/promises';
import { DocumentService } from './document.service';
import { DocumentStatus } from './enums/document-status.enum';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { VectorStoreService } from '../vector-store/vector-store.service';

interface DocumentProcessingJobData {
  documentId: number;
  filePath: string;
}

@Processor('document-processing')
export class DocumentProcessingWorker {
  private readonly logger = new Logger(DocumentProcessingWorker.name);

  constructor(
    private readonly documentService: DocumentService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  @Process('process-document')
  async handleProcessDocument(job: Job<DocumentProcessingJobData>): Promise<void> {
    const { documentId, filePath } = job.data;

    this.logger.log(`Start handling document #${documentId}`);

    const processingDoc = await this.documentService.updateStatus(
      documentId,
      DocumentStatus.PROCESSING,
    );
    await this.notifyUsers(processingDoc.id, 'document.processing');

    try {
      if (filePath.endsWith('.txt')) {
        const text = await fs.readFile(filePath, 'utf-8');
        await this.vectorStoreService.addDocuments(
          text,
          processingDoc.siteId,
          processingDoc.id,
          processingDoc.filename,
        );
      } else {
        // Fallback for non-txt files (simulate processing or ignore)
        await this.simulateProcessing();
      }

      const readyDoc = await this.documentService.updateStatus(documentId, DocumentStatus.READY);
      await this.notifyUsers(readyDoc.id, 'document.ready');
      this.logger.log(`Completed handling document #${documentId}`);
    } catch (error) {
      this.logger.error(`Error processing document #${documentId}:`, error);
      // Fallback or leave as PROCESSING/PENDING
      // Optional: notify user about failure
    }
  }

  private async notifyUsers(
    documentId: number,
    type: 'document.processing' | 'document.ready',
  ): Promise<void> {
    const document = await this.documentService.findOne(documentId);

    const userIdsToNotify = new Set([document.site.ownerId]);
    if (document.site.agents) {
      document.site.agents.forEach((agent) => userIdsToNotify.add(agent.id));
    }

    this.notificationsGateway.notifyUsers(Array.from(userIdsToNotify), {
      title: type === 'document.ready' ? 'Tài liệu đã sẵn sàng' : 'Tài liệu đang xử lý',
      message: `Tài liệu "${document.filename}" của site ${document.site.name} ${type === 'document.ready' ? 'đã sẵn sàng' : 'đang được xử lý'}`,
      type,
    });
  }

  private simulateProcessing(): Promise<void> {
    const delayMs = Math.floor(Math.random() * 5000) + 5000;
    return new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }
}
