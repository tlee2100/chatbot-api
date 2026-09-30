import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';

export class UserDto {
  @AutoMap()
  id!: number;

  @ApiProperty()
  @AutoMap()
  name!: string;

  @AutoMap()
  email!: string;

  @AutoMap()
  role!: Role;

  @AutoMap(() => String)
  bio?: string | null;

  @AutoMap(() => String)
  avatarUrl?: string | null;

  organization?: any;

  @AutoMap()
  organizationId?: number;
}
