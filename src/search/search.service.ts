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
      //alias
      {
        $lookup: {
          from: 'AkaList',
          localField: '_id',
          foreignField: 'sanctionedID',
          pipeline: [
            { $project: { _id: 0, firstName: 1, middleName: 1, lastName: 1 } },
          ],
          as: 'alias',
        },
      },
      //dateOfBirth
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
            { $project: { _id: 0, date: 1 } },
          ],
          as: 'dateOfBirth',
        },
      },
      //nationality
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
            { $project: { _id: 0, country: 1, code: 1 } },
          ],
          as: 'nationality',
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

    //$ $ $ $ $  AKA $ $ $ $ $ $
    const akaPipeline: any = [
      //search
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
      //sanctioned
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
                _id: 0,
                id: { $toString: '$_id' },
                listId: { $toString: '$listId' },
                firstName: 1,
                middleName: 1,
                lastName: 1,
                defaultName: 1,
                original_name: 1,
                otherNames: 1,
                type: 1,
              },
            },
          ],
          as: 'sanctioned',
        },
      },
      //sanctioned as objet
      {
        $addFields: {
          sanctionedObject: { $arrayElemAt: ['$sanctioned', 0] },
        },
      },
      //sanction
      {
        $lookup: {
          from: 'SanctionList',
          let: {
            id: { $toObjectId: '$sanctionedObject.listId' },
          },
          as: 'sanction',
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$id'],
                },
              },
            },
            { $project: { _id: 0, id: { $toString: '$_id' }, name: 1 } },
          ],
        },
      },
      //alias
      {
        $lookup: {
          from: 'AkaList',
          let: {
            id: { $toObjectId: '$sanctionedObject.id' },
          },
          as: 'alias',
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$sanctionedId', '$$id'],
                },
              },
            },
            { $project: { _id: 0, firstName: 1, middleName: 1, lastName: 1 } },
          ],
        },
      },
      //dateOfBirth
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
      //nationality
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
        this.helper.toCapitalizeWord(body.type) != 'Individual' &&
        this.helper.toCapitalizeWord(body.type) != 'Entity' &&
        this.helper.toCapitalizeWord(body.type) != 'Person'
      ) {
        throw new BadRequestException(
          'type value must be Individual person or Entity',
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
      akaPipeline.push({
        $match: {
          $expr: {
            $eq: [
              {
                $regexMatch: {
                  input: '$sanctionedObject.type',
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
          firstName: '$firstName',
          middleName: '$middleName',
          lastName: '$lastName',
          defaultName: '$defaultName',
          original_name: '$original_name',
          otherNames: '$otherNames',
          type: '$type',
        },
        sanction: {
          $arrayElemAt: ['$sanction', 0],
        },
        alias: '$alias',
        dateOfBirth: {
          $arrayElemAt: ['$dateOfBirth', 0],
        },
        nationality: {
          $arrayElemAt: ['$nationality', 0],
        },
        scoreAtlas: '$normalizedScore',
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
        alias: '$alias',
        dateOfBirth: {
          $arrayElemAt: ['$dateOfBirth', 0],
        },
        nationality: {
          $arrayElemAt: ['$nationality', 0],
        },
        scoreAtlas: '$normalizedScore',
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

    // merge akalist and sanctioned  and remove duplicate data and map
    const cleanedData = await this.helper.cleanSearch(
      sanctionedResult,
      akaResult,
      body.fullName,
    );

    //------ apply filters on results
    const filtered = await this.helper.filterCompleteSearch(cleanedData, body);

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
      //alias
      {
        $lookup: {
          from: 'AkaList',
          localField: '_id',
          foreignField: 'sanctionedID',
          pipeline: [
            { $project: { _id: 0, firstName: 1, middleName: 1, lastName: 1 } },
          ],
          as: 'alias',
        },
      },
      //dateOfBirth
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
            { $project: { _id: 0, date: 1 } },
          ],
          as: 'dateOfBirth',
        },
      },
      //nationality
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
            { $project: { _id: 0, country: 1, code: 1 } },
          ],
          as: 'nationality',
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
            firstName: '$firstName',
            middleName: '$middleName',
            lastName: '$lastName',
            defaultName: '$defaultName',
            original_name: '$original_name',
            otherNames: '$otherNames',
            type: '$type',
          },
          sanction: {
            $arrayElemAt: ['$sanction', 0],
          },
          alias: '$alias',
          dateOfBirth: {
            $arrayElemAt: ['$dateOfBirth', 0],
          },
          nationality: {
            $arrayElemAt: ['$nationality', 0],
          },
          scoreAtlas: '$normalizedScore',
        },
      },
    ];

    //$ $ $ $ $ AKA $ $ $ $
    const akaPipeline: any = [
      //search
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
      //sanctioned
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
                _id: 0,
                id: { $toString: '$_id' },
                listId: { $toString: '$listId' },
                firstName: 1,
                middleName: 1,
                lastName: 1,
                defaultName: 1,
                original_name: 1,
                otherNames: 1,
                type: 1,
              },
            },
          ],
          as: 'sanctioned',
        },
      },
      //sanctioned as objet
      {
        $addFields: {
          sanctionedObject: { $arrayElemAt: ['$sanctioned', 0] },
        },
      },
      //sanction
      {
        $lookup: {
          from: 'SanctionList',
          let: {
            id: { $toObjectId: '$sanctionedObject.listId' },
          },
          as: 'sanction',
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$id'],
                },
              },
            },
            { $project: { _id: 0, id: { $toString: '$_id' }, name: 1 } },
          ],
        },
      },
      //alias
      {
        $lookup: {
          from: 'AkaList',
          let: {
            id: { $toObjectId: '$sanctionedObject.id' },
          },
          as: 'alias',
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$sanctionedId', '$$id'],
                },
              },
            },
            { $project: { _id: 0, firstName: 1, middleName: 1, lastName: 1 } },
          ],
        },
      },
      //dateOfBirth
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
      //nationality
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
            $arrayElemAt: ['$sanctioned', 0],
          },
          sanction: {
            $arrayElemAt: ['$sanction', 0],
          },
          alias: '$alias',
          dateOfBirth: {
            $arrayElemAt: ['$dateOfBirth', 0],
          },
          nationality: {
            $arrayElemAt: ['$nationality', 0],
          },
          scoreAtlas: '$normalizedScore',
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

    //merge sanctioned and aka result into one array and remove duplicate
    const cleanedData = await this.helper.cleanSearch(
      sanctionedResult,
      akaResult,
      text,
    );

    //check if no results
    if (cleanedData.length <= 0) {
      this.logger.log('(success !) all is well');
      return {
        resultsCount: cleanedData.length,
        resultsFile: null,
        results: cleanedData,
      };
    }

    //generate Excel file
    this.logger.log('Generating Excel file ...');
    const downloadUrl = this.config.get('DOWNLOAD_URL');
    const excelData = this.helper.mapExcelData(
      cleanedData,
      text,
      cleanedData.length,
    );
    const file = await this.helper.generateExcel(excelData, text);

    this.logger.log('(success !) all is well');
    return {
      resultsCount: cleanedData.length,
      resultsFile: `${downloadUrl}${file}`,
      results: cleanedData,
    };
  }
}
