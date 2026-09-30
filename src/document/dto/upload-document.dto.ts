import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadDocumentDto {
  @ApiProperty({ example: 1, description: 'ID of the site this document belongs to' })
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @IsPositive()
  siteId!: number;
}
