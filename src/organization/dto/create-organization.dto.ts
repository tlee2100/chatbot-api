import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, MinLength, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'VTI Group' })
  @IsString()
  @IsNotEmpty({ message: 'Tên tổ chức không được để trống' })
  @MinLength(2, { message: 'Tên tổ chức phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Tên tổ chức không quá 100 ký tự' })
  name!: string;

  @ApiProperty({ example: 'vti-group' })
  @IsString()
  @IsNotEmpty({ message: 'Slug không được để trống' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang (-)',
  })
  @MaxLength(100)
  slug!: string;
}
