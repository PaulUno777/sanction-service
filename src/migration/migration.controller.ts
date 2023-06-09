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
import { createReadStream, createWriteStream, writeFile } from 'fs';
import { join } from 'path';
import { HttpService } from '@nestjs/axios';
import * as csvToJson from 'csvtojson';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

@Controller('migration')
@ApiTags('migration')
export class MigrationController {
  constructor(
    private readonly migrationService: MigrationService,
    private config: ConfigService,
    private readonly httpService: HttpService,
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

  @Get('test')
  async test() {
    return this.migrationService.test();
  }

  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json')
  @Get('download/:file')
  download(
    @Param('file') fileName,
    @Response({ passthrough: true }) res,
  ): StreamableFile {
    res.set({
      'Content-Type': 'application/json',
    });
    const dir = this.config.get('SOURCE_DIR');
    const file: any = createReadStream(join(process.cwd(), dir + fileName));
    if (!file) throw new NotFoundException('the source file does not exist');
    return new StreamableFile(file);
  }

  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/csv')
  @Get('csv')
  async downloadCSV() {
    const sanctionSource = this.config.get('SOURCE_DIR');
    const pepUrl = this.config.get('PEP_SOURCE');
    const downloadPath = `${sanctionSource}liste_PEP.json`;

    const writer = createWriteStream(downloadPath);

    const response = await firstValueFrom(
      this.httpService.get(pepUrl, { responseType: 'stream' }),
    );

    const jsonArray = await csvToJson().fromStream(response.data);

    writer.write(JSON.stringify(jsonArray));

    writer.end();
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}
