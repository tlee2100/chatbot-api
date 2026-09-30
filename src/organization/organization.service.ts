import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { QueryOrganizationDto } from './dto/query-organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>,
  ) {}

  async findAllPaginated(query: QueryOrganizationDto) {
    const { page = 1, limit = 10, name, slug, sortBy = 'createdAt', sortOrder = 'DESC' } = query;

    const qb = this.orgRepository.createQueryBuilder('org');

    if (name) {
      qb.andWhere('org.name ILIKE :name', { name: `%${name}%` });
    }
    if (slug) {
      qb.andWhere('org.slug ILIKE :slug', { slug: `%${slug}%` });
    }

    qb.orderBy(`org.${sortBy}`, sortOrder);
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Organization> {
    const org = await this.orgRepository.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException(`Không tìm thấy tổ chức với ID ${id}`);
    }
    return org;
  }

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    // Kiểm tra slug unique
    const existing = await this.orgRepository.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" đã được sử dụng`);
    }

    const org = this.orgRepository.create(dto);
    return this.orgRepository.save(org);
  }

  async update(id: number, dto: UpdateOrganizationDto): Promise<Organization> {
    // Kiểm tra org tồn tại
    await this.findOne(id);

    // Nếu đổi slug → kiểm tra trùng
    if (dto.slug) {
      const existing = await this.orgRepository.findOne({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Slug "${dto.slug}" đã được sử dụng`);
      }
    }

    await this.orgRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const org = await this.orgRepository.findOne({
      where: { id },
      relations: ['sites'], // Load quan hệ để kiểm tra
    });

    if (!org) {
      throw new NotFoundException(`Không tìm thấy tổ chức với ID ${id}`);
    }

    if (org.sites && org.sites.length > 0) {
      throw new ConflictException(
        `Tổ chức này còn ${org.sites.length} site đang liên kết. Hãy xóa hoặc gỡ liên kết các site trước.`,
      );
    }

    await this.orgRepository.delete(id);
  }
}
