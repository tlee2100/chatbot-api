import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Document } from './document.entity';
import { Site } from '../../site/entities/site.entity';

@Entity('document_chunks')
@Unique(['documentId', 'chunkIndex'])
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: number;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Column()
  @Index()
  siteId: number;

  @ManyToOne(() => Site, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'siteId' })
  site: Site;

  @Column()
  chunkIndex: number;

  @Column('text')
  content: string;

  @Column({
    type: 'vector',
    length: 1536,
  })
  embedding: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
