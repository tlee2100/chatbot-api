import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { AutoMap } from '@automapper/classes';
import { Site } from '../../site/entities/site.entity';
import { Role } from '../enums/role.enum';
import { Organization } from '../../organization/entities/organization.entity';

@Entity()
export class Users {
  @AutoMap()
  @PrimaryGeneratedColumn()
  id!: number;

  @AutoMap()
  @Column()
  name!: string;

  @AutoMap()
  @Column({ unique: true })
  email!: string;

  @Column()
  @Exclude()
  password!: string;

  @AutoMap()
  @Column({
    type: 'enum',
    enum: Role,
    default: Role.AGENT,
  })
  role!: Role;

  @AutoMap()
  @Column({ nullable: true })
  organizationId?: number;

  @ManyToOne(() => Organization, (org) => org.users, { nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @AutoMap(() => String)
  @Column({ type: 'varchar', length: 300, nullable: true })
  bio?: string | null;

  @AutoMap(() => String)
  @Column({ type: 'varchar', nullable: true })
  avatarUrl?: string | null;

  @OneToMany(() => Site, (site) => site.owner)
  sites!: Site[];

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  twoFactorSecret?: string | null; // shared secret, never exposed to the client

  @Column({ default: false })
  twoFactorEnabled!: boolean;

  @ManyToMany(() => Site, (site) => site.agents)
  assignedSites!: Site[];
}
