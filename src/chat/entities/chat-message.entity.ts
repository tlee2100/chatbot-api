import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { Users } from '../../user/entities/user.entity';

export enum SenderType {
  VISITOR = 'VISITOR',
  AGENT = 'AGENT',
  AI = 'AI',
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  // Identifies if the sender was the external visitor or an internal agent
  @Column({
    type: 'enum',
    enum: SenderType,
  })
  senderType: SenderType;

  // If sender is an agent, we link it to the user table. If visitor, this is null.
  @Column({ nullable: true })
  agentId: number;

  @ManyToOne(() => Users, { nullable: true })
  @JoinColumn({ name: 'agentId' })
  agent: Users;

  // The actual text payload
  @Column('text')
  content: string;

  @Column({
    type: 'enum',
    enum: MessageStatus,
    default: MessageStatus.SENT,
  })
  status: MessageStatus;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  reactions: Record<string, string[]>;

  @Column({ type: 'jsonb', nullable: true })
  knowledgeSources: { documentId: number; filename: string }[];

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true })
  fileType: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
