import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchParamDto } from './dto/search.param.dto';
import { SearchHelper } from './search.helper';
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private prisma: PrismaService,
    private helper: SearchHelper,
    private config: ConfigService,
  ) {}

  //======== FILTERED SEARCH =================================

  async searchfiltered(body: SearchParamDto) {
    this.logger.log('Filtered searching ...');
    console.log(body);
    let matchRate = 0.4;
    let maxEdits = 2;
    let maxExpansions = 100;
    if (body.matchRate) {
      const rates = [40, 50, 60, 70, 80];
      if (
        !rates.includes(body.matchRate) ||
        typeof body.matchRate != 'number'
      ) {
        throw new BadRequestException(
          'Invalid parameter ! matchRate must be a number in the set [50, 60, 70, 80]',
        );
      } else {
        switch (matchRate) {
          case 50:
            maxEdits = 2;
            maxExpansions = 80;
            break;
          case 60:
          case 70:
            maxEdits = 2;
            maxExpansions = 60;
            break;
          case 80:
            maxEdits = 1;
            maxExpansions = 40;
            break;
          default:
            break;
        }
        matchRate = body.matchRate / 100;
      }
    }
    ////$ $ $ $ $  SANCTIONED $ $ $ $ $ $
    const sanctionedPipeline: any = [
      {
        //search
        $search: {
          index: 'sanctionned_index',
          text: {
            query: body.fullName,
            path: ['defaultName', 'akas'],
            fuzzy: {
              maxEdits: maxEdits,
              maxExpansions: maxExpansions,
            },
          },
        },
      },
      //sanction
      {
        $lookup: {
          from: 'SanctionList',
          localField: 'listId',
          foreignField: '_id',
          pipeline: [
            { $project: { _id: 0, id: { $toString: '$_id' }, name: 1 } },
          ],
          as: 'sanction',
        },
      },
      //limit
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' },
        },
      },
      {
        $setWindowFields: {
          output: {
            searchScoreMax: { $max: '$searchScore' },
          },
        },
      },
      {
        $addFields: {
          normalizedScore: {
            $divide: ['$searchScore', '$searchScoreMax'],
          },
        },
      },
      {
        $match: { normalizedScore: { $gte: matchRate } },
      },
    ];

    //check if type is provided in request parameters
    if (typeof body.type == 'string') {
      if (
        body.type.toLowerCase() != 'individual' &&
        body.type.toLowerCase() != 'entity' &&
        body.type.toLowerCase() != 'vessel'
      ) {
        throw new BadRequestException(
          'type value must be Individual Entity or Vessel',
        );
      }
      sanctionedPipeline.push({
        $match: {
          $expr: {
            $eq: [
              {
                $regexMatch: {
                  input: '$type',
                  regex: body.type,
                  options: 'i',
                },
              },
              true,
            ],
          },
        },
      });
    }

    sanctionedPipeline.push({
      $project: {
        _id: 0,
        entity: {
          id: { $toString: '$_id' },
          listId: { $toString: '$listId' },
          defaultName: '$defaultName',
          type: '$type',
          remarks: '$remarks',
          publicationUrl: '$publicationUrl',
        },
        sanction: {
          $arrayElemAt: ['$sanction', 0],
        },
        alias: '$akas',
        dateOfBirth: '$dateOfBirth',
        placeOfBirth: '$placeOfBirth',
        nationality: '$nationalities',
        citizenships: '$citizenships',
        scoreAtlas: '$normalizedScore',
      },
    });

    // Request query to mongoDB
    //----- in sanctioned collection
    const result: any = await this.prisma.sanctioned.aggregateRaw({
      pipeline: sanctionedPipeline,
    });

    // merge akalist and sanctioned  and remove duplicate data and map
    const cleanedData = await this.helper.cleanSearch(result, body.fullName);
    // //------ apply filters on results
    const filtered = await this.helper.filteredSearch(cleanedData, body);

    //check if no results
    if (filtered.length <= 0) {
      return {
        resultsCount: filtered.length,
        resultsFile: null,
        results: filtered,
      };
    }
    //generate Excel file
    this.logger.log('Generating Excel file ...');
    const downloadUrl = this.config.get('DOWNLOAD_URL');
    const excelData = this.helper.mapExcelData(filtered, body.fullName);
    const file = await this.helper.generateExcel(excelData, body.fullName);

    this.logger.log('(success !) all is well');
    return {
      resultsCount: filtered.length,
      resultsFile: `${downloadUrl}${file}`,
      results: filtered,
    };
  }

  //======== SIMPLE SEARCH =================================
  async searchSimple(text: string): Promise<any> {
    this.logger.log('simple searching ...');
    const regex = /[0-9]{4}/g;
    if (typeof text != 'string' || text.length <= 3 || regex.test(text))
      throw new BadRequestException(
        'Invalid parameter(!) You must provide real fullname to search',
      );

    //Request query to mongoDB
    //----sanctioned
    const sanctionedPipeline: any = [
      {
        //search
        $search: {
          index: 'sanctionned_index',
          text: {
            query: text,
            path: ['defaultName', 'akas'],
            fuzzy: {
              maxEdits: 2,
            },
          },
        },
      },
      //sanction
      {
        $lookup: {
          from: 'SanctionList',
          localField: 'listId',
          foreignField: '_id',
          pipeline: [
            { $project: { _id: 0, id: { $toString: '$_id' }, name: 1 } },
          ],
          as: 'sanction',
        },
      },
      //limit
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' },
        },
      },
      {
        $setWindowFields: {
          output: {
            searchScoreMax: { $max: '$searchScore' },
          },
        },
      },
      {
        $addFields: {
          normalizedScore: {
            $divide: ['$searchScore', '$searchScoreMax'],
          },
        },
      },
      {
        $match: { normalizedScore: { $gte: 0.4 } },
      },
      {
        $project: {
          _id: 0,
          entity: {
            id: { $toString: '$_id' },
            listId: { $toString: '$listId' },
            defaultName: '$defaultName',
            type: '$type',
            remarks: '$remarks',
            publicationUrl: '$publicationUrl',
          },
          sanction: {
            $arrayElemAt: ['$sanction', 0],
          },
          alias: '$akas',
          dateOfBirth: '$dateOfBirth',
          placeOfBirth: '$placeOfBirth',
          nationality: '$nationalities',
          citizenships: '$citizenships',
          scoreAtlas: '$normalizedScore',
        },
      },
    ];

    // Request query to mongoDB
    //----- in sanctioned collection
    const result: any = await this.prisma.sanctioned.aggregateRaw({
      pipeline: sanctionedPipeline,
    });

    //merge sanctioned and aka result into one array and remove duplicate
    const cleanedData = await this.helper.cleanSearch(result, text);

    //check if no results
    if (cleanedData.length <= 0) {
      return {
        resultsCount: cleanedData.length,
        resultsFile: null,
        results: cleanedData,
      };
    }

    //generate Excel file
    this.logger.log('Generating Excel file ...');
    const downloadUrl = this.config.get('DOWNLOAD_URL');
    const excelData = this.helper.mapExcelData(cleanedData, text);
    const file = await this.helper.generateExcel(excelData, text);

    this.logger.log('(success !) all is well');
    return {
      resultsCount: cleanedData.length,
      resultsFile: `${downloadUrl}${file}`,
      results: cleanedData,
    };
  }
}
