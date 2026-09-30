import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Role } from 'src/user/enums/role.enum';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { QueryOrganizationDto } from './dto/query-organization.dto';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @ApiOperation({ summary: 'Get paginated list of organizations' })
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get()
  findAll(@Query() query: QueryOrganizationDto) {
    return this.organizationService.findAllPaginated(query);
  }

  @ApiOperation({ summary: 'Get one organization by ID' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.organizationService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new organization (SUPER_ADMIN only)' })
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @ApiOperation({ summary: 'Update an organization (SUPER_ADMIN only)' })
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete an organization (SUPER_ADMIN only)' })
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.organizationService.remove(id);
  }
}
