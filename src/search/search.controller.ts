import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Header,
  Param,
  StreamableFile,
  Response,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { SearchParamDto } from './dto/search.param.dto';
import { SearchService } from './search.service';
import { join } from 'path';

@Controller('search')
@ApiTags('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private config: ConfigService,
  ) {}

  @Get()
  search() {
    // return this.searchService.findAll();
  }

  @Post()
  searchfiltered(@Body() body: SearchParamDto) {
    return this.searchService.searchfiltered(body);
  }

  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/xlsx')
  @Get('download/:file')
  download(
    @Param('file') fileName,
    @Response({ passthrough: true }) res,
  ): StreamableFile {
    res.set({
      'Content-Type': 'application/xlsx',
      'Content-Disposition': 'attachment; filename="seach-result.xlsx',
    });
    const dir = this.config.get('FILE_LOCATION');
    const file: any = createReadStream(join(process.cwd(), dir + fileName));
    return new StreamableFile(file);
    //file.pipe(response);
  }
}
