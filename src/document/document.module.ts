import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Document } from './entities/document.entity';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { DocumentProcessingWorker } from './document-processing.worker';
import { ChatModule } from '../chat/chat.module';
import { SiteModule } from '../site/site.module';
import { NotificationsModule } from '../auth/notifications/notifications.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    BullModule.registerQueue({
      name: 'document-processing',
    }),
    ChatModule,
    SiteModule,
    NotificationsModule,
    VectorStoreModule,
  ],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentProcessingWorker],
  exports: [DocumentService],
})
export class DocumentModule {}
