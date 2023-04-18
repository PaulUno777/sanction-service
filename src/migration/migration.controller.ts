import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Response,
  StreamableFile,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { MigrationService } from './migration.service';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { join } from 'path';

@Controller('migration')
@ApiTags('migration')
export class MigrationController {
  constructor(
    private readonly migrationService: MigrationService,
    private config: ConfigService,
  ) {}

  @ApiExcludeEndpoint()
  @Get()
  async migrate() {
    return this.migrationService.getFileSource();
  }
  @Get('update')
  async update() {
    return this.migrationService.updateAllToMongo();
  }

  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json')
  @Get('download/:file')
  download(
    @Param('file') fileName,
    @Response({ passthrough: true }) res,
  ): StreamableFile {
    res.set({
      'Content-Type': 'application/xlsx',
      'Content-Disposition': 'attachment; filename="seach-result.xlsx',
    });
    const dir = this.config.get('SOURCE_DIR');
    const file: any = createReadStream(join(process.cwd(), dir + fileName));
    if (!file) throw new NotFoundException('the source file does not exist');
    return new StreamableFile(file);
  }
}
