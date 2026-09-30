import { IsString, IsUrl, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSiteDto {
  @ApiProperty({
    description: 'The name of the site',
    example: 'My Awesome Site',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'The URL of the site',
    example: 'https://www.example.com',
  })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ description: 'The ID of the organization', example: 1 })
  @IsOptional()
  @IsNumber()
  organizationId?: number;
}
