import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../enums/role.enum';

export enum SortField {
  NAME = 'name',
  EMAIL = 'email',
  ROLE = 'role',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class QueryUserDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number, starting from 1',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Number of items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filter by name (partial match)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by email (partial match)' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ enum: Role, description: 'Filter by exact role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: SortField, description: 'Field to sort by' })
  @IsOptional()
  @IsEnum(SortField)
  sortBy?: SortField = SortField.NAME;

  @ApiPropertyOptional({ enum: SortOrder, description: 'Sort direction' })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;
}
