import { MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { MigrationModule } from './migration/migration.module';
import { SanctionedModule } from './sanctioned/sanctioned.module';
import { SearchModule } from './search/search.module';
import { SanctionModule } from './sanction/sanction.module';
import { ScheduleModule } from '@nestjs/schedule';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MigrationModule,
    SanctionedModule,
    SearchModule,
    SanctionModule,
  ],
  providers: [],
})
export class AppModule implements NestModule, OnModuleInit {
  onModuleInit() {
    const SOURCE_DIR = './sanctions_source/';
    const PUBLIC_DIR = './public/'
    
    //manage source directory
    if (!existsSync(join(process.cwd(), PUBLIC_DIR))) {
      mkdirSync(join(process.cwd(), PUBLIC_DIR));
      console.log('public directory created');
    }
    if (!existsSync(join(process.cwd(), SOURCE_DIR))) {
      mkdirSync(join(process.cwd(), SOURCE_DIR));
      console.log('sanction source directory created');
    }
  }
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
