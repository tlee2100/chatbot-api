import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from './entities/site.entity';
import { Users } from '../user/entities/user.entity';
import { SiteService } from './site.service';
import { SiteController } from './site.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Site, Users])],
  providers: [SiteService],
  controllers: [SiteController],
  exports: [SiteService],
})
export class SiteModule {}
