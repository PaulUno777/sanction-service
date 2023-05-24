import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ConfigService } from '@nestjs/config';
import { unlink } from 'fs';
import * as StringSimilarity from 'string-similarity';
import { SearchOutput } from './dto/search.output.dto';
import { SearchParamDto } from './dto/search.param.dto';
import { Nationality } from './dto/Sanctioned.entity';

@Injectable()
export class SearchHelper {
  private readonly logger = new Logger(SearchHelper.name);
  constructor(private config: ConfigService) {}
  // map sanctioned data into sanctionedDto
  getNames(result: any) {
    let names = [];
    names.push(result.entity.defaultName);
    if (result.alias && result.alias.length > 0)
      names = names.concat(result.alias);
    return names;
  }

  // map aka data into sanctionedDto
  mapSearchResult(result: any, fullName: string): SearchOutput {
    const entity = {
      id: result.entity.id,
      defaultName: result.entity.defaultName,
      type: result.entity.type,
      remarks: result.remarks,
      sanction: result.sanction,
      publicationUrl: result.publicationUrl,
    };

    if (result.dateOfBirth && result.dateOfBirth != null) {
      entity['dateOfBirth'] = result.dateOfBirth;
    }

    if (result.placeOfBirth && result.placeOfBirth != null) {
      entity['placeOfBirth'] = result.placeOfBirth;
    }

    if (result.nationality && result.nationality.length > 0) {
      entity['nationalities'] = result.nationality;
    }

    if (result.citizenships && result.citizenships.length > 0) {
      entity['citizenships'] = result.citizenships;
    }
    const names = this.getNames(result);
    const score = this.setPercentage(names, fullName);

    return { entity, score };
  }

  // merge akalist and sanctioned  and remove duplicate data
  cleanSearch(searchResult: any[], fullName?: string): any[] {
    //remove duplicate
    const cleanData = searchResult.map((item) => {
      return this.mapSearchResult(item, fullName);
    });
    cleanData.sort((a, b) => b.score - a.score);
    console.log({ searchResult: searchResult.length });
    return cleanData;
  }

  //Apply nationality and date of birth filters to retrieved data
  filteredSearch(response: any[], body: SearchParamDto) {
    let filteredData = response;

    //filter by score if needed
    if (body.matchRate) {
      this.logger.log('====== Filtering by score...');
      filteredData = filteredData.filter((value) => {
        return value.score >= body.matchRate;
      });
    }

    //check if sanctionId is provided in request parameters
    if (body.sanction) {
      this.logger.log('====== Filtering by sanction...');
      filteredData = filteredData.filter((value) => {
        return body.sanction.includes(value.entity.sanction.id);
      });
      console.log({ filteredCount: filteredData.length });
    }
  
    //filter by date of birth
    if (body.dob) {
      this.logger.log('====== Filtering by date of birth...');
      if (body.dob.length != 4 && body.dob.length != 7)
        throw new BadRequestException('dob value must be YYYY-MM or YYYY');

      const tempData = filteredData.filter((value: any) => {
        if (value.entity.dateOfBirth) {
          return this.checkDate(value.entity.dateOfBirth, body.dob);
        }
      });
      filteredData = tempData;
      console.log({ Datefiltered: filteredData.length });
    }
    //filter by nationalities
    if (body.nationality) {
      this.logger.log('====== Filtering by natinality...');
      const tempData = filteredData.filter((value: any) => {
        if (value.entity.nationalities) {
          for (const isoCode of body.nationality) {
            if (this.checkNationality(value.entity.nationalities, isoCode))
              return true;
          }
        }
        if (value.entity.citizenships) {
          for (const isoCode of body.nationality) {
            if (this.checkNationality(value.entity.citizenships, isoCode))
              return true;
          }
        }
        if (value.entity.placeOfBirth) {
          for (const isoCode of body.nationality) {
            if (this.checkPlaceOfBirth(value.entity.placeOfBirth, isoCode))
              return true;
          }
        }
      });
      filteredData = tempData;
      console.log({ nationalityfiltered: filteredData.length });
    }

    return filteredData;
  }

  //generate excel file and return path
  async generateExcel(searchResult: any[], searchInput: string) {
    this.logger.log('----- generating Excel file');
    const workbook = new Workbook();
    workbook.creator = 'kamix-conformity-service';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Search Result', {
      headerFooter: { firstHeader: 'SCAN REPORT' },
    });
    //create headers
    sheet.columns = [
      { header: 'Search Input', key: 'searchInput', width: 35 },
      { header: 'Results', key: 'result', width: 40 },
      { header: 'Sanctions', key: 'sanction', width: 68 },
      { header: 'Date Of Birth', key: 'dob', width: 12 },
      { header: 'Nationality', key: 'nationality', width: 20 },
      { header: 'Match Rates (%)', key: 'matchRate', width: 15 },
      { header: 'View Links', key: 'link', width: 45 },
      { header: 'Style', key: 'style', hidden: true },
    ];

    sheet.getRow(1).font = {
      name: 'Calibri',
      family: 4,
      size: 11,
      bold: true,
    };

    //add rows
    sheet.addRows(searchResult);

    //styling the worksheet
    sheet.eachRow((row) => {
      row.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      row.getCell('F').alignment = {
        horizontal: 'right',
      };
      // [ 'C', 'G'].map((key) => {
      //   row.getCell(key).alignment = {
      //     horizontal: 'justify',
      //   };
      // });

      if (row.getCell('H').value == 0) {
        ['B', 'C', 'D', 'E', 'F'].forEach((key) => {
          row.getCell(key).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'E2EFDA' },
          };
          row.getCell(key).font = {
            color: { argb: '33B050' },
          };
        });
      }
      if (row.getCell('H').value == 1) {
        ['A', 'G'].map((key) => {
          row.getCell(key).border = {
            left: { style: 'thin' },
            right: { style: 'thin' },
            top: { style: 'thin' },
            bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
          };
        });
        ['B', 'C', 'D', 'E', 'F'].forEach((key) => {
          row.getCell(key).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FCE4D6' },
          };
          row.getCell(key).font = {
            color: { argb: 'FF0056' },
          };
          row.getCell(key).border = {
            left: { style: 'thin' },
            right: { style: 'thin' },
            top: { style: 'thin' },
            bottom: { style: 'thin', color: { argb: 'FCE4D6' } },
          };
        });
      }
      if (row.getCell('H').value == 3) {
        ['A', 'G'].map((key) => {
          row.getCell(key).border = {
            left: { style: 'thin' },
            right: { style: 'thin' },
            top: { style: 'thin', color: { argb: 'FFFFFF' } },
            bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
          };
        });
        ['B', 'C', 'D', 'E', 'F'].map((key) => {
          row.getCell(key).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FCE4D6' },
          };
          row.getCell(key).border = {
            left: { style: 'thin' },
            right: { style: 'thin' },
            top: { style: 'thin', color: { argb: 'FCE4D6' } },
            bottom: { style: 'thin', color: { argb: 'FCE4D6' } },
          };
        });
      }
      row.commit();
    });

    //write the
    const name = `${searchInput}.xlsx`;
    const fileName = name.replace(/\s/g, '');
    const publicDir = this.config.get('FILE_LOCATION');
    const pathToFile = publicDir + fileName;

    await unlink(pathToFile, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log('Successfully deleted the file.');
      }
    });

    await workbook.xlsx.writeFile(pathToFile);

    return fileName;
  }

  //clean data for excel
  mapExcelData(array: any[], searchInput: string): any[] {
    this.logger.log('----- Mapping data for Excel');
    const cleanData = [];

    if (array.length > 0) {
      let dobString = null;
      let nationality = null;

      cleanData.push({
        style: 1,
        searchInput: searchInput,
        result: 'Potential match detected',
        matchRate: array[0].score + ' %',
      });
      array.forEach((elt, index) => {
        let name = '';
        if (elt.entity.dateOfBirth) {
          const dateOfBirth = elt.entity.dateOfBirth;
          let day = '';
          if (dateOfBirth.day != null) day = `${dateOfBirth.day}/`;
          let month = '';
          if (dateOfBirth.month != null) month = `${dateOfBirth.month}/`;
          let year = '';
          if (dateOfBirth.year != null) year = `${dateOfBirth.year}`;
          //to string date
          dobString = `${day}${month}${year}`;
        }

        if (elt.entity.nationality)
          nationality = elt.entity.nationality[0].country;

        name = elt.entity.defaultName;

        const DETAIL_URL = this.config.get('DETAIL_URL');
        cleanData.push({
          style: 3,
          result: `${index}. (${elt.score}%) - ${name}`,
          sanction: elt.entity.sanction.name,
          dob: dobString,
          nationality: nationality,
          link: `${DETAIL_URL}${elt.entity.id}/information`,
        });
      });
    } else {
      cleanData.push({
        style: 0,
        searchInput: searchInput,
        result: 'No match detected',
        matchRate: '0.00 %',
      });
    }
    return cleanData;
  }

  checkDate(responseDate, bodyDate: string): boolean {
    let check = false;
    if (bodyDate.includes('-')) {
      const [year, month] = bodyDate.trim().split('-');
      if (responseDate.year == year && responseDate.month == month)
        check = true;
    } else {
      if (responseDate.year == bodyDate.trim()) check = true;
    }
    return check;
  }

  checkPlaceOfBirth(placeOfBirth, isoCode: string): boolean {
    if (placeOfBirth) {
      if (placeOfBirth.country) {
        return isoCode.toUpperCase() === placeOfBirth.country.isoCode;
      } else {
        return false;
      }
    }
    return false;
  }

  checkNationality(
    entityNationalities: Nationality[],
    bodyIsoCode: string,
  ): boolean {
    if (entityNationalities instanceof Array) {
      let test = false;
      for (const name of entityNationalities) {
        let isoCode = '';
        if (name.isoCode) isoCode = name.isoCode.toLowerCase();
        const reqCode = bodyIsoCode.toLowerCase();
        if (isoCode === reqCode) {
          test = true;
          break;
        }
      }
      return test;
    } else {
      return false;
    }
  }

  //transform score into percentage
  setPercentage(allNames: string[], fullName: string): number {
    let maxScore = 0;
    for (const name of allNames) {
      const score = StringSimilarity.compareTwoStrings(
        name.toUpperCase(),
        fullName.toUpperCase(),
      );
      if (score > maxScore) {
        maxScore = score;
      }
    }
    const data = maxScore * 100;
    return Number(data.toFixed(2));
  }
}
