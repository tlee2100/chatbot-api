import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { classes } from '@automapper/classes';
import { AutomapperModule } from '@automapper/nestjs';
import { UserController } from './user.controller';
import { Users } from './entities/user.entity';
import { UserService } from './user.service';
import { UserMappingProfile } from './user.mapping-profile';
import { NotificationsModule } from '../auth/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users]),
    AutomapperModule.forRoot({
      strategyInitializer: classes(),
    }),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [UserController],
  providers: [UserService, UserMappingProfile],
  exports: [UserService],
})
export class UserModule {}
