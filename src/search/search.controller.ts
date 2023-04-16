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
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiQuery, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { SearchParamDto } from './dto/search.param.dto';
import { SearchService } from './search.service';
import { join } from 'path';
import { NotFoundException } from '@nestjs/common/exceptions';

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
        valueSet: [40, 50, 60, 70, 80],
        exemple: 40,
      },
    ];
  }

  @Post()
  searchfiltered(@Body() body: SearchParamDto) {
    //Check all body parameters
    const regex = /[0-9]{4}/g;
    if (body.fullName.length <= 3 || regex.test(body.fullName))
      throw new BadRequestException(
        'Invalid parameter(!) You must provide real fullname to search',
      );

    if (body.dob) {
      if (
        (body.dob.length != 4 && body.dob.length != 7) ||
        !regex.test(body.dob)
      )
        throw new BadRequestException(
          'Invalid parameter ! dob must be a YYYY-MM or YYYY',
        );
    }

    if (body.sanction) {
      if (body.sanction.length <= 0 || Array.isArray(body.sanction) == false)
        throw new BadRequestException(
          'Invalid parameter ! sanction must be unempty list of sanction ids',
        );
    }

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
    if (!file)
      throw new NotFoundException('the file for this search does not exist');
    return new StreamableFile(file);
  }
}
