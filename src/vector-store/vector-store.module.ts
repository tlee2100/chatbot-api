import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VectorStoreService } from './vector-store.service';
import { DocumentChunk } from '../document/entities/document-chunk.entity';
import { Document } from '../document/entities/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentChunk, Document])],
  providers: [VectorStoreService],
  exports: [VectorStoreService],
})
export class VectorStoreModule {}
