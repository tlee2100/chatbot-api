import { Injectable, ConflictException } from '@nestjs/common';
import { Repository, FindOptionsWhere } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import * as bcrypt from 'bcrypt';
import { InjectMapper } from '@automapper/nestjs';
import type { Mapper } from '@automapper/core';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { Users } from './entities/user.entity';
import { Role } from './enums/role.enum';
import { UserDto } from './dto/user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { PaginatedUserDto } from './dto/paginated-user.dto';
import { NotificationsGateway } from '../auth/notifications/notifications.gateway';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    @InjectMapper() private readonly mapper: Mapper,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async findAll(): Promise<UserDto[]> {
    const users = await this.usersRepository.find();
    return this.mapper.mapArray(users, Users, UserDto);
  }

  async findOne(where: FindOptionsWhere<Users>): Promise<UserDto | null> {
    const user = await this.usersRepository.findOne({ where, relations: ['organization'] });
    if (!user) return null;
    return this.mapper.map(user, Users, UserDto);
  }

  // async findOne(where: FindOptionsWhere<Users>): Promise<UserDto | null> {
  //   const user = await this.usersRepository.findOne({
  //     where: {
  //       id: where.id ? where.id : undefined,
  //       email: where.email ? where.email : undefined,
  //       role: where.role ? where.role : undefined,
  //     },
  //   });

  //   if (!user) return null;
  //   return this.mapper.map(user, Users, UserDto);
  // }

  async findOneWithPassword(where: FindOptionsWhere<Users>): Promise<Users | null> {
    return await this.usersRepository.findOne({
      where,
    });
  }

  async updateUser(
    id: number,
    dto: UpdateUserDto,
    updaterId?: number,
    updaterRole?: Role,
  ): Promise<UserDto | null> {
    if (dto.email) {
      // Only check for duplicate emails if the user actually submits an email.
      const existingUser = await this.usersRepository.findOne({
        where: { email: dto.email },
      });
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already exists');
      }
    }

    const updateData = { ...dto } as any;
    // Prevent role updates completely
    if ('role' in updateData) {
      delete updateData.role;
    }
    if (updaterId && updaterRole !== Role.SUPER_ADMIN && 'organizationId' in updateData) {
      delete updateData.organizationId;
    }

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10); // Re-hash if the password is changed.
    }

    await this.usersRepository.update(id, updateData);
    return this.findOne({ id: Number(id) });
  }

  async deleteUser(id: number): Promise<void> {
    await this.usersRepository.delete({ id: Number(id) });
  }

  async create(dto: CreateUserDto, creatorId?: number, creatorRole?: Role): Promise<UserDto> {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const existingUser = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const user = this.usersRepository.create({
      name: dto.name,

      email: dto.email,

      password: hashedPassword,

      role: creatorRole === Role.SUPER_ADMIN ? Role.ADMIN : Role.AGENT,
    });

    let orgId = dto.organizationId;
    if (creatorId && creatorRole !== Role.SUPER_ADMIN) {
      const creator = await this.usersRepository.findOne({ where: { id: creatorId } });
      orgId = creator?.organizationId ?? undefined;
    }
    user.organizationId = orgId;

    // Check if save if successful
    // return the user information without the password
    const savedUser = await this.usersRepository.save(user);
    this.notificationsGateway.notify({
      type: 'user.created',
      title: 'New user',
      message: `${savedUser.email} has registered an account`,
    });
    return this.findOne({ id: savedUser.id }) as unknown as UserDto;
  }

  async findAllPaginated(
    query: QueryUserDto,
    currentUserId?: number,
    currentUserRole?: Role,
  ): Promise<PaginatedUserDto> {
    const { page = 1, limit = 10, name, email, role, sortBy = 'name', sortOrder = 'ASC' } = query;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'organization');

    if (currentUserRole && currentUserRole !== Role.SUPER_ADMIN && currentUserId) {
      const currentUser = await this.usersRepository.findOne({ where: { id: currentUserId } });
      if (currentUser?.organizationId) {
        queryBuilder.andWhere('user.organizationId = :orgId', {
          orgId: currentUser.organizationId,
        });
      } else {
        // If admin has no org, only show themselves
        queryBuilder.andWhere('user.id = :currentUserId', { currentUserId });
      }
    }

    console.log(`[findAllPaginated] query param:`, query);

    if (name) {
      queryBuilder.andWhere('user.name ILIKE :name', { name: `%${name}%` });
    }
    if (email) {
      queryBuilder.andWhere('user.email ILIKE :email', { email: `%${email}%` });
    }
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    queryBuilder.orderBy(`user.${sortBy}`, sortOrder);
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();
    const data = this.mapper.mapArray(users, Users, UserDto);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateTwoFactorSecret(id: number, secret: string | null): Promise<void> {
    await this.usersRepository.update(id, {
      twoFactorSecret: secret,
    });
  }

  async setTwoFactorEnabled(id: number, enabled: boolean): Promise<void> {
    await this.usersRepository.update(id, { twoFactorEnabled: enabled });
  }

  async updateAvatar(id: number, avatarUrl: string): Promise<UserDto | null> {
    await this.usersRepository.update(id, { avatarUrl });
    return this.findOne({ id });
  }
}
