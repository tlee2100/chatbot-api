import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Paginate, ApiPaginationQuery } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
import { SiteService } from './site.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../user/enums/role.enum';
import { AssignAgentDto } from './dto/assign-agent.dto';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@ApiTags('Sites')
@Controller('sites')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @ApiOperation({ summary: 'Create a new site (ADMIN/SUPER_ADMIN only)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  async create(@Body() dto: CreateSiteDto, @Request() req: AuthenticatedRequest) {
    const ownerId = req.user.id;
    return this.siteService.create(dto, ownerId, req.user.role);
  }

  @ApiOperation({ summary: 'Get all sites (no pagination)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Get('all')
  async findAll() {
    return this.siteService.findAll();
  }

  @ApiOperation({ summary: 'Paginated site listing (ADMIN sees all, AGENT sees own sites)' })
  @ApiBearerAuth('access-token')
  @ApiPaginationQuery({
    sortableColumns: ['id', 'name', 'url', 'knowledgeBaseStatus'],
    searchableColumns: ['name'],
    filterableColumns: { name: true, knowledgeBaseStatus: true },
  })
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAllPaginated(@Paginate() query: PaginateQuery, @Request() req: AuthenticatedRequest) {
    return this.siteService.findAllPaginated(query, req.user.id, req.user.role);
  }

  @ApiOperation({ summary: 'Get a single site by id' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.siteService.findOne(id);
  }

  @ApiOperation({ summary: 'Get public site info for visitors (Unauthenticated)' })
  @Get('public/:id')
  async getPublicSiteInfo(@Param('id') id: number) {
    const site = await this.siteService.findOne(id);
    return {
      id: site.id,
      name: site.name,
    };
  }

  @ApiOperation({ summary: 'Update a site (owner or ADMIN only)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateSiteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (req.user.role !== Role.SUPER_ADMIN && 'organizationId' in dto) {
      delete dto.organizationId;
    }
    return this.siteService.update(id, dto, req.user.id, req.user.role);
  }

  @ApiOperation({ summary: 'Delete a site (owner or ADMIN only)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: number, @Request() req: AuthenticatedRequest) {
    return this.siteService.remove(id, req.user.id, req.user.role);
  }

  @ApiOperation({ summary: 'Assign an agent to a site (ADMIN only)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post(':id/agents')
  async assignAgent(@Param('id') id: number, @Body() dto: AssignAgentDto) {
    return this.siteService.assignAgent(id, dto.agentId);
  }

  @ApiOperation({ summary: 'Remove an agent from a site (ADMIN only)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(':id/agents/:agentId')
  async removeAgent(@Param('id') id: number, @Param('agentId') agentId: number) {
    return this.siteService.removeAgent(id, agentId);
  }
}
