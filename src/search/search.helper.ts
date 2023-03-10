import { Injectable, Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ConfigService } from '@nestjs/config';
import * as i18nIsoCountries from 'i18n-iso-countries';
import * as fs from 'fs';
import * as StringSimilarity from 'string-similarity';
import { SearchOutput } from './dto/search.output.dto';
import { SearchParamDto } from './dto/search.param.dto';

@Injectable()
export class SearchHelper {
  private readonly logger = new Logger(SearchHelper.name);
  constructor(private config: ConfigService) {}
  // map sanctioned data into sanctionedDto
  mapSanctioned(result: any): SearchOutput {
    const entity = {
      id: result._id.$oid,
      firstName: result.firstName,
      middleName: result.middleName,
      lastName: result.lastName,
      type: result.type,
      originalName: result.original_name,
      otherNames: result.otherNames,
      sanction: {
        id: result.sanction._id.$oid,
        name: result.sanction.name,
      },
    };

    if (result.dateOfBirth != null)
      entity['dateOfBirth'] = result.dateOfBirth.date;
    if (result.nationality != null) {
      const nationality = {};
      if (result.nationality.code)
        nationality['code'] = result.nationality.code;
      if (result.nationality.country)
        nationality['country'] = result.nationality.country;
      entity['nationality'] = nationality;
    }

    const score: number = this.setPercentage(result.score);

    return { entity, score };
  }

  // map aka data into sanctionedDto
  mapAka(result: any): SearchOutput {
    const entity = {
      id: result.entity._id.$oid,
      firstName: result.entity.firstName,
      middleName: result.entity.middleName,
      lastName: result.entity.lastName,
      type: result.type,
      originalName: result.entity.original_name,
      otherNames: result.entity.otherNames,
      sanction: {
        id: result.sanction._id.$oid,
        name: result.sanction.name,
      },
    };

    if (result.dateOfBirth != null) {
      entity['dateOfBirth'] = result.dateOfBirth.date;
    }

    if (result.nationality != null) {
      if (result.nationality != null) {
        const nationality = {};
        if (result.nationality.code)
          nationality['code'] = result.nationality.code;
        if (result.nationality.country)
          nationality['country'] = result.nationality.country;
        entity['nationality'] = nationality;
      }
    }

    const score: number = this.setPercentage(result.score);

    return { entity, score };
  }

  // merge akalist and sanctioned  and remove duplicate data
  async cleanSearch(array1: any[], array2: any[]): Promise<any[]> {
    this.logger.log('Cleanning search and sort by score ...');
    const cleanData: any[] = array1.concat(array2);

    cleanData.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
    const filtered = this.removeDuplicate(cleanData);
    return filtered;
  }

  // remove duplicate data
  removeDuplicate(data: any[]): any[] {
    this.logger.log('Removing duplicate from AkaList and Sanctioned ...');
    const indexes = [];
    const filtered = [];

    if (data.length > 1) {
      data.forEach(function (item) {
        if (!indexes.includes(item.entity.id)) {
          indexes.push(item.entity.id);
          filtered.push(item);
        }
      });
    }
    return filtered;
  }

  // merge akalist and sanctioned
  mergeSearch(array1: any[], array2: any[]) {
    this.logger.log('Merging arrays and sort by score ...');
    const cleanData: any[] = array1.concat(array2);
    cleanData.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
    return cleanData;
  }

  //Apply nationality and date of birth filters to retrieved data
  async filterCompleteSearch(response: any[], body: SearchParamDto) {
    let filteredData = response;

    if (body.dob) {
      this.logger.log('====== Filtering by date...');
      const tempData = [];
      let check: boolean;
      response.forEach((value: any) => {
        if (value.entity.dateOfBirth) {
          check = this.checkDate(value.entity.dateOfBirth, body.dob);
          if (check) tempData.push(value);
        }
      });
      filteredData = tempData;
      this.logger.log('success !');
    }

    if (
      body.nationality &&
      body.nationality.length > 0 &&
      body.nationality != null
    ) {
      this.logger.log('====== Filtering by natinality...');
      const tempArray = filteredData.filter((value: any) => {
        let test = false;
        if (value.entity.nationality) {
          if (value.entity.nationality.code) {
            test = body.nationality.includes(value.entity.nationality.code);
            this.logger.log('success ! --- Finded in coutry ');
          } else {
            const nationalities: any = this.getBodyNationalityNames(
              body.nationality,
            );
            test = this.checkNationality(
              value.entity.nationality.country,
              nationalities,
            );
          }
        }
        return test;
      });

      filteredData = tempArray;
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

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir);
    }

    await fs.unlink(pathToFile, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log('Successfully deleted the file.');
      }
    });

    await workbook.xlsx.writeFile(pathToFile);

    return fileName;
  }

  //clean data
  mapExcelData(array: any[], searchInput: string, resultCount: number): any[] {
    this.logger.log('----- Mapping data for Excel');
    const cleanData = [];

    if (resultCount > 0) {
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
          nationality = elt.entity.nationality.country;

        if (
          elt.entity.firstName ||
          elt.entity.middleName ||
          elt.entity.lastName
        ) {
          if (elt.entity.firstName != null)
            name = name + ' ' + elt.entity.firstName;
          if (elt.entity.middleName != null)
            name = name + ' ' + elt.entity.middleName;
          if (elt.entity.lastName != null)
            name = name + ' ' + elt.entity.lastName;
        } else {
          if (elt.entity.originalName != null) {
            name = name + ' ' + elt.entity.originalName;
          } else {
            for (const value of elt.entity.otherNames) {
              name = name + ' ' + value;
            }
          }
        }

        cleanData.push({
          style: 3,
          result: `${index}. (${elt.score}%) - ${name}`,
          sanction: elt.entity.sanction.name,
          dob: dobString.trim(),
          nationality: nationality,
          link: `todoByFrontDev/${elt.entity.id}`,
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

  getBodyNationalityNames(codes: string[]) {
    let result = [];
    codes.map(async (elt) => {
      const countryCode = elt.toUpperCase();
      const nameFr = i18nIsoCountries.getName(countryCode, 'fr');
      const nameEn = i18nIsoCountries.getName(countryCode, 'en');

      let arrayFr = [];
      if (nameFr) arrayFr = this.transfarmName(nameFr);
      let arrayEn;
      if (nameEn) arrayEn = this.transfarmName(nameEn);

      const tempArray = arrayFr.concat(arrayEn);
      result = result.concat(tempArray);
    });
    console.log({ code: result });
    return result;
  }

  removeAccents(text: string): string {
    return text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  transfarmName(name: string): string[] {
    const cleanedName = this.toCapitalizeWord(this.removeAccents(name.trim()));
    let tempArray = [];
    if (cleanedName.trim().includes(' ')) {
      tempArray = cleanedName.trim().split(' ');
      return tempArray.filter((item) => {
        if (item.length > 3) return item;
      });
    } else {
      return [cleanedName];
    }
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

  checkNationality(
    santionedNationality: string,
    codeNationality: string[],
  ): boolean {
    const nationalities = this.transfarmName(santionedNationality);
    console.log({ sanctioned: nationalities });
    let test = false;
    nationalities.forEach((name) => {
      for (const country of codeNationality) {
        const score = StringSimilarity.compareTwoStrings(name, country);
        if (score > 0.8) {
          this.logger.log('success ! --- Finded in coutry name');
          test = true;
          break;
        }
      }
    });
    return test;
  }

  toCapitalizeWord(str: string): string {
    const reg = /[- ]/;
    const splitStr = str.toLowerCase().split(reg);
    for (let i = 0; i < splitStr.length; i++) {
      splitStr[i] =
        splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
    // Directly return the joined string
    return splitStr.join(' ');
  }

  //transform score into percentage
  setPercentage(score: number): number {
    const data = score * 100;
    return Number(data.toFixed(2));
  }
}
