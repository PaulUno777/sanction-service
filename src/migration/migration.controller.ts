import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MigrationService } from './migration.service';

@Controller('migration')
@ApiTags('migration')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Get()
  async migrate() {
    this.migrationService.migrateAllToMongo();
  }

  @Get('update')
  async update() {
    return this.migrationService.updateAllToMongo();
  }
}
