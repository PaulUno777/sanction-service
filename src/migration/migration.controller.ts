import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { MigrationService } from './migration.service';

@Controller('migration')
@ApiTags('migration')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @ApiExcludeEndpoint()
  @Get()
  async migrate() {
    return this.migrationService.getFileSource();
  }
  @Get('update')
  async update() {
    return this.migrationService.updateAllToMongo();
  }
}
