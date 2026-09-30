import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from 'src/user/enums/role.enum';
import { FilterOperator, paginate, Paginated, PaginateQuery } from 'nestjs-paginate';
import { Site } from './entities/site.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { Users } from '../user/entities/user.entity';

@Injectable()
export class SiteService {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepository: Repository<Site>,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
  ) {}

  async create(dto: CreateSiteDto, ownerId: number, creatorRole: Role): Promise<Site> {
    let orgId = dto.organizationId;

    // If not super admin, assign the site to the creator's organization
    if (creatorRole !== Role.SUPER_ADMIN) {
      const owner = await this.userRepository.findOne({ where: { id: ownerId } });
      orgId = owner?.organizationId ?? undefined;
    }

    const site = this.siteRepository.create({
      ...dto,
      organizationId: orgId,
      ownerId,
    });
    const savedSite = await this.siteRepository.save(site);
    return this.findOne(savedSite.id);
  }

  async findAll(): Promise<Site[]> {
    return this.siteRepository.find({
      relations: ['owner', 'agents', 'documents', 'organization'],
    });
  }

  async findOne(id: number): Promise<Site> {
    const site = await this.siteRepository.findOne({
      where: { id },
      relations: ['owner', 'agents', 'documents', 'organization'],
    });
    if (!site) {
      throw new NotFoundException(`Site with id ${id} not found`);
    }
    return site;
  }

  async findAllPaginated(
    query: PaginateQuery,
    currentUserId: number,
    currentUserRole: Role,
  ): Promise<Paginated<Site>> {
    const queryBuilder = this.siteRepository
      .createQueryBuilder('site')
      .leftJoinAndSelect('site.owner', 'owner')
      .leftJoinAndSelect('site.agents', 'agents')
      .leftJoinAndSelect('site.documents', 'documents')
      .leftJoinAndSelect('site.organization', 'organization');

    switch (currentUserRole) {
      case Role.SUPER_ADMIN:
        break;

      case Role.ADMIN:
        queryBuilder.andWhere('site.ownerId = :ownerId', { ownerId: currentUserId });
        break;

      case Role.AGENT:
        queryBuilder.andWhere(
          'site.id IN (SELECT sa."siteId" FROM site_agents sa WHERE sa."agentId" = :agentId)',
          { agentId: currentUserId },
        );
        break;

      default: {
        const exhaustiveCheck: never = currentUserRole;
        throw new ForbiddenException(
          `Role "${String(exhaustiveCheck)}" is not permitted to list sites`,
        );
      }
    }

    return paginate(query, queryBuilder, {
      sortableColumns: ['id', 'name', 'url', 'knowledgeBaseStatus'],
      searchableColumns: ['name'],
      defaultSortBy: [['id', 'ASC']],
      filterableColumns: {
        name: [FilterOperator.EQ, FilterOperator.ILIKE],
        knowledgeBaseStatus: [FilterOperator.EQ],
      },
    });
  }

  async update(
    id: number,
    dto: UpdateSiteDto,
    currentUserId: number,
    currentUserRole: Role,
  ): Promise<Site> {
    const site = await this.findOne(id);

    // Only the owner of the site, an admin, or a super admin can update it
    if (
      site.ownerId !== currentUserId &&
      currentUserRole !== Role.ADMIN &&
      currentUserRole !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException('You do not have permission to update this site');
    }

    await this.siteRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number, currentUserId: number, currentUserRole: Role): Promise<void> {
    const site = await this.findOne(id);

    // Only the owner of the site, an admin, or a super admin can delete it
    if (
      site.ownerId !== currentUserId &&
      currentUserRole !== Role.ADMIN &&
      currentUserRole !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException('You do not have permission to delete this site');
    }

    await this.siteRepository.delete(id);
  }

  // Only the site owner, an assigned agent, an admin, or a super admin may act on the site
  async assertSiteAccess(
    siteId: number,
    currentUserId: number,
    currentUserRole: Role,
  ): Promise<Site> {
    const site = await this.findOne(siteId);

    if (currentUserRole === Role.ADMIN || currentUserRole === Role.SUPER_ADMIN) {
      return site;
    }

    const isOwner = site.ownerId === currentUserId;
    const isAssignedAgent = site.agents.some((agent) => agent.id === currentUserId);

    if (!isOwner && !isAssignedAgent) {
      throw new ForbiddenException('You do not have access to this site');
    }

    return site;
  }

  async assignAgent(siteId: number, agentId: number): Promise<Site> {
    console.log(
      `[assignAgent] called with siteId: ${siteId} (type: ${typeof siteId}), agentId: ${agentId} (type: ${typeof agentId})`,
    );
    const site = await this.siteRepository.findOne({
      where: { id: siteId },
      relations: ['agents'],
    });
    if (!site) {
      console.log(`[assignAgent] Site not found`);
      throw new NotFoundException(`Site with id ${siteId} not found`);
    }

    const alreadyAssigned = site.agents.some((agent) => Number(agent.id) === Number(agentId));
    if (alreadyAssigned) {
      console.log(`[assignAgent] Agent already assigned`);
      throw new BadRequestException('Agent is already assigned to this site');
    }

    try {
      console.log(`[assignAgent] Attempting to add relation...`);
      await this.siteRepository
        .createQueryBuilder()
        .relation(Site, 'agents')
        .of(siteId)
        .add(agentId);
      console.log(`[assignAgent] Relation added successfully!`);
    } catch (error) {
      console.error(`[assignAgent] Error adding relation:`, error);
      throw error;
    }

    return this.findOne(siteId);
  }

  async removeAgent(siteId: number, agentId: number): Promise<Site> {
    const site = await this.siteRepository.findOne({
      where: { id: siteId },
      relations: ['agents'],
    });
    if (!site) {
      throw new NotFoundException(`Site with id ${siteId} not found`);
    }

    await this.siteRepository
      .createQueryBuilder()
      .relation(Site, 'agents')
      .of(siteId)
      .remove(agentId);

    return this.findOne(siteId);
  }
}
