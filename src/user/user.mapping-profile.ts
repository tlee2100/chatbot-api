import { Injectable } from '@nestjs/common';
import { InjectMapper, AutomapperProfile } from '@automapper/nestjs';
import { createMap, forMember, mapFrom } from '@automapper/core';

import type { Mapper } from '@automapper/core';
import { Users } from './entities/user.entity';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UserMappingProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper);
  }

  override get profile() {
    return (mapper: Mapper) => {
      createMap(
        mapper,
        Users,
        UserDto,
        forMember(
          (d) => d.organization,
          mapFrom((s) => s.organization),
        ),
      );
    };
  }
}
