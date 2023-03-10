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
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
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

  @ApiQuery({
    name: 'text',
    description: 'text to search',
    required: true,
    type: 'string',
  })
  @Get()
  search(@Query() query: Record<string, any>) {
    return this.searchService.searchSimple(String(query.text));
  }
  @Get('filter')
  getFilter() {
    return [
      {
        name: 'dob',
        paramType: 'body',
        type: 'string',
        valueSet: null,
        exemple: '1963-03',
      },
      {
        name: 'nationality',
        paramType: 'body',
        type: 'array<string>',
        valueSet: null,
        exemple: '[rus, fr]',
      },
      {
        name: 'sanctionId',
        paramType: 'body',
        type: 'string',
        valueSet: null,
        exemple: 'xxxxxxxxxxxxxxxxxxxxxx',
      },
      {
        name: 'type',
        paramType: 'body',
        type: 'string',
        valueSet: ['person', 'Entity', 'Individual'],
        exemple: '[rus, fr]',
      },
      {
        name: 'matchRate',
        paramType: 'body',
        type: 'number',
        valueSet: [50, 60, 70, 80],
        exemple: 50,
      },
    ];
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
