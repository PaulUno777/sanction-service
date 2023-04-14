import { Module } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import { HttpModule } from '@nestjs/axios';
import { MigrationHelper } from './migration.helper';

@Module({
  imports: [HttpModule],
  providers: [MigrationService, MigrationHelper],
  controllers: [MigrationController],
})
export class MigrationModule {}
