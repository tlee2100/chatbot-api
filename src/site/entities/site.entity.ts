import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  JoinTable,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { Document } from '../../document/entities/document.entity';
import { Users } from '../../user/entities/user.entity';
import { KnowledgeBaseStatus } from '../enums/knowledge-base-status.enum';
import { Organization } from '../../organization/entities/organization.entity';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  url!: string;

  @Column()
  ownerId!: number;

  @Column({
    //
    type: 'enum',
    enum: KnowledgeBaseStatus,
    default: KnowledgeBaseStatus.PENDING,
  })
  knowledgeBaseStatus!: KnowledgeBaseStatus;

  @Column({ nullable: true })
  organizationId?: number;

  @ManyToOne(() => Organization, (org) => org.sites, { nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @ManyToOne(() => Users, (user) => user.sites)
  @JoinColumn({ name: 'ownerId' })
  owner!: Users;

  @OneToMany(() => Document, (document) => document.site)
  documents!: Document[];

  @ManyToMany(() => Users, (user) => user.assignedSites)
  @JoinTable({
    name: 'site_agents', // tên bảng trung gian
    joinColumn: { name: 'siteId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'agentId', referencedColumnName: 'id' },
  })
  agents!: Users[];

  @Column({ nullable: true, default: '#0066FF' })
  themeColor: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({
    nullable: true,
    default: 'Hi there! How can we help you today?',
  })
  welcomeMessage: string;
}
