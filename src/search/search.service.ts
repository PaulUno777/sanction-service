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
    let matchRate = 0.5;
    if (body.matchRate && typeof body.matchRate == 'number') {
      const rates = [50, 60, 70, 80];
      if (rates.includes(body.matchRate)) {
        matchRate = body.matchRate / 100;
      } else {
        throw new BadRequestException(
          'matchRate must be a number in the set [50, 60, 70, 80]',
        );
      }
    }
    if (typeof body.sanctionId == 'string') {
      if (body.sanctionId.length != 24)
        throw new BadRequestException('Invalid sanctionId');
    }

    if (typeof body.fullName != 'string' || body.fullName.length <= 3)
      throw new BadRequestException('You must provide real fullname to search');

    //Request query to mongoDB
    //----sanctioned
    const sanctionedPipeline: any = [
      {
        $search: {
          index: 'sanctionned_index',
          text: {
            query: body.fullName,
            path: [
              'firstName',
              'lastName',
              'middleName',
              'originalName',
              'otherNames',
            ],
            fuzzy: {
              maxEdits: 2,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'SanctionList',
          localField: 'listId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'sanction',
        },
      },
      {
        $lookup: {
          from: 'DateOfBirthList',
          let: {
            id: '$_id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$sanctionedId', '$$id'],
                },
              },
            },
            { $project: { date: 1 } },
          ],
          as: 'dateOfBirth',
        },
      },
      {
        $lookup: {
          from: 'NationalityList',
          let: {
            id: '$_id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$sanctionedId', '$$id'],
                },
              },
            },
            { $project: { country: 1, code: 1 } },
          ],
          as: 'nationality',
        },
      },
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' },
        },
      },
      {
        $setWindowFields: {
          output: {
            searchMaxScore: { $max: '$searchScore' },
          },
        },
      },
      {
        $addFields: {
          searchNormalizedScore: {
            $divide: ['$searchScore', '$searchMaxScore'],
          },
        },
      },
      {
        $match: { searchNormalizedScore: { $gte: matchRate } },
      },
    ];

    const akaPipeline: any = [
      {
        $search: {
          index: 'sanctioned_aka_index',
          text: {
            query: body.fullName,
            path: ['firstName', 'lastName', 'middleName'],
            fuzzy: {
              maxEdits: 2,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'Sanctioned',
          let: {
            id: '$sanctionedId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$id'],
                },
              },
            },
            {
              $project: {
                listId: 1,
                firstName: 1,
                middleName: 1,
                type: 1,
                lastName: 1,
                original_name: 1,
                otherNames: 1,
              },
            },
          ],
          as: 'sanctioned',
        },
      },
      {
        $lookup: {
          from: 'SanctionList',
          localField: 'sanctioned.0.listId',
          foreignField: '_id',
          as: 'sanction',
          pipeline: [
            {
              $project: {
                name: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'DateOfBirthList',
          let: {
            id: '$sanctionedId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$sanctionedId', '$$id'],
                },
              },
            },
            {
              $project: {
                _id: 0,
                date: 1,
              },
            },
          ],
          as: 'dateOfBirth',
        },
      },
      {
        $lookup: {
          from: 'NationalityList',
          let: {
            id: '$sanctionedId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$sanctionedId', '$$id'],
                },
              },
            },
            {
              $project: {
                _id: 0,
                country: 1,
                code: 1,
              },
            },
          ],
          as: 'nationality',
        },
      },
      {
        $addFields: {
          searchScore: {
            $meta: 'searchScore',
          },
        },
      },
      {
        $setWindowFields: {
          output: {
            searchMaxScore: {
              $max: '$searchScore',
            },
          },
        },
      },
      {
        $addFields: {
          searchNormalizedScore: {
            $divide: ['$searchScore', '$searchMaxScore'],
          },
        },
      },
      {
        $match: {
          searchNormalizedScore: {
            $gte: matchRate,
          },
        },
      },
    ];

    //check if type is provided in request parameters
    if (typeof body.type == 'string') {
      if (
        this.helper.toCapitalizeWord(body.type) != 'Individual' &&
        this.helper.toCapitalizeWord(body.type) != 'Entity' &&
        this.helper.toCapitalizeWord(body.type) != 'Person'
      ) {
        throw new BadRequestException(
          'type value must be Individual or Entity',
        );
      }
      sanctionedPipeline.push({
        $match: {
          $expr: {
            $eq: [{ $strcasecmp: ['$type', body.type] }, 0],
          },
        },
      });
      akaPipeline.push({
        $match: {
          $expr: {
            $eq: [{ $strcasecmp: ['$sanctionedObject.type', body.type] }, 0],
          },
        },
      });
    }

    sanctionedPipeline.push({
      $project: {
        listId: 1,
        firstName: 1,
        middleName: 1,
        lastName: 1,
        original_name: 1,
        otherNames: 1,
        type: 1,
        sanction: {
          $arrayElemAt: ['$sanction', 0],
        },
        dateOfBirth: {
          $arrayElemAt: ['$dateOfBirth', 0],
        },
        nationality: {
          $arrayElemAt: ['$nationality', 0],
        },
        initialScore: '$searchScore',
        maxScore: '$searchMaxScore',
        score: '$searchNormalizedScore',
      },
    });

    akaPipeline.push({
      $project: {
        _id: 0,
        entity: {
          $arrayElemAt: ['$sanctioned', 0],
        },
        sanction: {
          $arrayElemAt: ['$sanction', 0],
        },
        dateOfBirth: {
          $arrayElemAt: ['$dateOfBirth', 0],
        },
        nationality: {
          $arrayElemAt: ['$nationality', 0],
        },
        initialScore: '$searchScore',
        maxScore: '$searchMaxScore',
        score: '$searchNormalizedScore',
      },
    });

    // Request query to mongoDB
    //----- in sanctioned collection
    this.logger.log('in sanctioned collection ...');
    const sanctionedResult: any = await this.prisma.sanctioned.aggregateRaw({
      pipeline: sanctionedPipeline,
    });
    //----- in akaList collection
    this.logger.log('in aka collection ...');
    const akaResult: any = await this.prisma.akaList.aggregateRaw({
      pipeline: akaPipeline,
    });

    this.logger.log('(success !) searching');

    // map data
    //---- sanctioned
    const sanctionedClean: any[] = await sanctionedResult.map((elt) => {
      const cleanData = this.helper.mapSanctioned(elt);
      return cleanData;
    });
    //---- akaList
    const akaClean: any[] = await akaResult.map((elt) => {
      const cleanData = this.helper.mapAka(elt);
      return cleanData;
    });

    //merge sanctioned and aka results into one array
    this.logger.log('Merging and appliying nationality && date filters ...');
    //------ merge results
    const cleanData = await this.helper.cleanSearch(sanctionedClean, akaClean);
    //------ apply filters on results
    const filtered = await this.helper.filterCompleteSearch(cleanData, body);

    //check if no results
    if (filtered.length <= 0) {
      this.logger.log('(success !) all is well');
      return {
        resultsCount: filtered.length,
        resultsFile: null,
        results: filtered,
      };
    }
    //generate Excel file
    this.logger.log('Generating Excel file ...');
    const downloadUrl = this.config.get('DOWNLOAD_URL');
    const excelData = this.helper.mapExcelData(
      filtered,
      body.fullName,
      filtered.length,
    );
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
    if (typeof text != 'string' || text.length <= 3)
      throw new BadRequestException('You must provide real fullname to search');

    //Request query to mongoDB
    //----sanctioned
    const sanctionedPipeline: any = [
      {
        $search: {
          index: 'sanctionned_index',
          text: {
            query: text,
            path: [
              'firstName',
              'lastName',
              'middleName',
              'originalName',
              'otherNames',
            ],
            fuzzy: {
              maxEdits: 2,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'SanctionList',
          localField: 'listId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'sanction',
        },
      },
      {
        $lookup: {
          from: 'DateOfBirthList',
          let: {
            id: '$_id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$sanctionedId', '$$id'],
                },
              },
            },
            { $project: { date: 1 } },
          ],
          as: 'dateOfBirth',
        },
      },
      {
        $lookup: {
          from: 'NationalityList',
          let: {
            id: '$_id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$sanctionedId', '$$id'],
                },
              },
            },
            { $project: { country: 1, code: 1 } },
          ],
          as: 'nationality',
        },
      },
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' },
        },
      },
      {
        $setWindowFields: {
          output: {
            searchMaxScore: { $max: '$searchScore' },
          },
        },
      },
      {
        $addFields: {
          searchNormalizedScore: {
            $divide: ['$searchScore', '$searchMaxScore'],
          },
        },
      },
      {
        $match: { searchNormalizedScore: { $gte: 0.5 } },
      },
      {
        $project: {
          listId: 1,
          firstName: 1,
          middleName: 1,
          lastName: 1,
          original_name: 1,
          otherNames: 1,
          type: 1,
          sanction: {
            $arrayElemAt: ['$sanction', 0],
          },
          dateOfBirth: {
            $arrayElemAt: ['$dateOfBirth', 0],
          },
          nationality: {
            $arrayElemAt: ['$nationality', 0],
          },
          initialScore: '$searchScore',
          maxScore: '$searchMaxScore',
          score: '$searchNormalizedScore',
        },
      },
    ];

    //----aka
    const akaPipeline: any = [
      {
        $search: {
          index: 'sanctioned_aka_index',
          text: {
            query: text,
            path: ['firstName', 'lastName', 'middleName'],
            fuzzy: {
              maxEdits: 2,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'Sanctioned',
          let: {
            id: '$sanctionedId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$id'],
                },
              },
            },
            {
              $project: {
                listId: 1,
                firstName: 1,
                middleName: 1,
                type: 1,
                lastName: 1,
                original_name: 1,
                otherNames: 1,
              },
            },
          ],
          as: 'sanctioned',
        },
      },
      {
        $lookup: {
          from: 'SanctionList',
          localField: 'sanctioned.0.listId',
          foreignField: '_id',
          as: 'sanction',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'DateOfBirthList',
          let: { id: '$sanctionedId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$sanctionedId', '$$id'],
                },
              },
            },
            { $project: { _id: 0, date: 1 } },
          ],
          as: 'dateOfBirth',
        },
      },
      {
        $lookup: {
          from: 'NationalityList',
          let: {
            id: '$sanctionedId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$sanctionedId', '$$id'],
                },
              },
            },
            { $project: { _id: 0, country: 1, code: 1 } },
          ],
          as: 'nationality',
        },
      },
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' },
        },
      },
      {
        $setWindowFields: {
          output: {
            searchMaxScore: { $max: '$searchScore' },
          },
        },
      },
      {
        $addFields: {
          searchNormalizedScore: {
            $divide: ['$searchScore', '$searchMaxScore'],
          },
        },
      },
      {
        $match: { searchNormalizedScore: { $gte: 0.5 } },
      },
      {
        $project: {
          _id: 0,
          entity: {
            $arrayElemAt: ['$sanctioned', 0],
          },
          sanction: {
            $arrayElemAt: ['$sanction', 0],
          },
          dateOfBirth: {
            $arrayElemAt: ['$dateOfBirth', 0],
          },
          nationality: {
            $arrayElemAt: ['$nationality', 0],
          },
          initialScore: '$searchScore',
          maxScore: '$searchMaxScore',
          score: '$searchNormalizedScore',
        },
      },
    ];

    // Request query to mongoDB
    //----- in sanctioned collection
    this.logger.log('searching sanctioned collection ...');
    const sanctionedResult: any = await this.prisma.sanctioned.aggregateRaw({
      pipeline: sanctionedPipeline,
    });
    //----- in akaList collection
    this.logger.log('searching aka collection ...');
    const akaResult: any = await this.prisma.akaList.aggregateRaw({
      pipeline: akaPipeline,
    });
    this.logger.log('(success !) searching');

    // map data
    //---- sanctioned
    const sanctionedClean: any[] = await sanctionedResult.map((elt) => {
      const cleanData = this.helper.mapSanctioned(elt);
      return cleanData;
    });
    //---- akaList
    const akaClean: any[] = await akaResult.map((elt) => {
      const cleanData = this.helper.mapAka(elt);
      return cleanData;
    });

    //merge sanctioned and aka result into one array and remove duplicate
    this.logger.log('Merging and sorting ...');
    const cleanData = await this.helper.cleanSearch(sanctionedClean, akaClean);
    const downloadUrl = this.config.get('DOWNLOAD_URL');

    //check if no results
    if (cleanData.length <= 0) {
      this.logger.log('(success !) all is well');
      return {
        resultsCount: cleanData.length,
        resultsFile: null,
        results: cleanData,
      };
    }
    //generate Excel file
    this.logger.log('Generating Excel file ...');
    const excelData = this.helper.mapExcelData(
      cleanData,
      text,
      cleanData.length,
    );
    const file = await this.helper.generateExcel(excelData, text);

    this.logger.log('(success !) all is well');
    return {
      resultsCount: cleanData.length,
      resultsFile: `${downloadUrl}${file}`,
      results: cleanData,
    };
  }
}
