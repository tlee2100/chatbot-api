import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUrl, IsOptional, IsNumber } from 'class-validator';

export class UpdateSiteDto {
  @ApiPropertyOptional({ example: 'My Site Updated' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/updated' })
  @IsUrl()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({ description: 'The ID of the organization', example: 1 })
  @IsOptional()
  @IsNumber()
  organizationId?: number;
}
