import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Site } from '../../site/entities/site.entity';
import { DocumentStatus } from '../enums/document-status.enum';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  filename!: string;

  @Column()
  filePath!: string;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
  })
  status!: DocumentStatus;

  @Column()
  siteId!: number;

  @ManyToOne(() => Site, (site) => site.documents)
  @JoinColumn({ name: 'siteId' })
  site!: Site;

  @CreateDateColumn()
  uploadedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt!: Date | null;
}
