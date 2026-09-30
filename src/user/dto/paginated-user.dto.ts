import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';

export class PaginatedUserDto {
  @ApiProperty({ type: [UserDto] })
  data!: UserDto[];

  @ApiProperty({ example: 42, description: 'Total number of matching records' })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 5, description: 'Total number of pages' })
  totalPages!: number;
}
