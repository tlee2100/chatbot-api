import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Site } from '../../site/entities/site.entity';
import { Users } from '../../user/entities/user.entity';
import { ChatMessage } from './chat-message.entity';

export enum ConversationStatus {
  OPEN = 'OPEN',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
}

export enum HandlingStatus {
  AI_HANDLING = 'AI_HANDLING',
  WAITING_FOR_AGENT = 'WAITING_FOR_AGENT',
  AGENT_HANDLING = 'AGENT_HANDLING',
}

@Entity('conversations')
export class Conversation {
  // Using UUID is better for public-facing IDs so visitors can't guess other conversation IDs
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  siteId: number;

  @ManyToOne(() => Site)
  @JoinColumn({ name: 'siteId' })
  site: Site;

  @Column({ nullable: true })
  agentId: number;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'agentId' })
  agent: Users;

  // We capture the visitor's details provided in the landing page
  @Column()
  visitorName: string;

  @Column()
  visitorEmail: string;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.OPEN,
  })
  status: ConversationStatus;

  @Column({
    type: 'enum',
    enum: HandlingStatus,
    default: HandlingStatus.AI_HANDLING,
  })
  handlingStatus: HandlingStatus;

  @Column({ default: true })
  isAiActive: boolean;

  // Used by a cron job or socket gateway to automatically close inactive chats
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastActivityAt: Date;

  @OneToMany(() => ChatMessage, (message) => message.conversation)
  messages: ChatMessage[];

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'int', default: 0 })
  summarizedMessageCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
