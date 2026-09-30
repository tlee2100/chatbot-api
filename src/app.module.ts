import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { UserModule } from './user/user.module';
import { SiteModule } from './site/site.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { DocumentModule } from './document/document.module';
import { NotificationsModule } from './auth/notifications/notifications.module';
import { OrganizationModule } from './organization/organization.module';
import { McpModule } from './mcp/mcp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CoreModule,
    SharedModule,
    UserModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    ChatModule,
    NotificationsModule,

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    DocumentModule,
    SiteModule,
    OrganizationModule,
    AuthModule,
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', 'uploads', 'avatars'),
        serveRoot: '/uploads/avatars',
      },
      {
        rootPath: join(__dirname, '..', 'uploads', 'chat'),
        serveRoot: '/uploads/chat',
      },
      { rootPath: join(__dirname, '..', 'public') },
    ),
    McpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
