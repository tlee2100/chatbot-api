import {
  Controller,
  Post,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { Users } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
// import { FindOptionsWhere } from 'typeorm';
import { Role } from './enums/role.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

import { QueryUserDto } from './dto/query-user.dto';
import { PaginatedUserDto } from './dto/paginated-user.dto';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { avatarUploadOptions } from './config/avatar-upload.config';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Create a new user(ADMIN only)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<UserDto> {
    return this.userService.create(createUserDto, req.user.id, req.user.role);
  }

  @ApiOperation({ summary: 'Get all users, or filter by id, email, or role' })
  @ApiQuery({ name: 'id', required: false, type: Number })
  @ApiQuery({ name: 'email', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @Get('all')
  async findAll(): Promise<Partial<Users>[]> {
    return this.userService.findAll();
  }

  @ApiOperation({ summary: 'Get a single user by id' })
  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.userService.findOne({ id });
  }

  @ApiOperation({
    summary: 'Update your own profile (name, email, password only — no role)',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  async updateOwnProfile(@Body() dto: UpdateProfileDto, @Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.userService.updateUser(userId, dto);
  }

  @ApiOperation({ summary: 'Update any user, including role (ADMIN only)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateUserDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.userService.updateUser(id, dto, req.user.id, req.user.role);
  }

  @ApiOperation({ summary: 'Delete a user by id(ADMIN only)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(':id')
  async delete(@Param('id') id: number, @Request() req: AuthenticatedRequest) {
    return this.userService.deleteUser(id, req.user.id);
  }

  @ApiOperation({ summary: 'Get paginated list of users with filter and sort' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get()
  async findAllPaginated(
    @Query() query: QueryUserDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PaginatedUserDto> {
    return this.userService.findAllPaginated(query, req.user.id, req.user.role);
  }

  @ApiOperation({ summary: 'Upload or replace your own avatar image' })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseGuards(AuthGuard('jwt'))
  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.userService.updateAvatar(req.user.id, avatarUrl);
  }
}
