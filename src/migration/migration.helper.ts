import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map } from 'rxjs';
import { AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';
import { parseString, parser } from 'xml2js';
import { parseStringPromise } from 'xml2js';
import { createWriteStream, unlink } from 'fs';
import https from 'https';
import crypto from 'crypto';

@Injectable()
export class MigrationHelper {
  private readonly logger = new Logger(MigrationHelper.name);
  constructor(
    private config: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  //transform id algorithm
  transformId(id: number): string {
    if (!id) return '';
    let tempId: string;
    let count = 0;

    tempId = id.toString();
    const length = 24 - tempId.length;

    for (let i = 0; i < length; i++) {
      if (count > 9) count = 0;
      tempId += count;
      count++;
    }
    return tempId;
  }

  async saveJsonFromXml(downloadLink: string, fileName: string): Promise<any> {
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const response = await firstValueFrom(
      this.httpService.get(downloadLink).pipe(
        catchError((error) => {
          this.logger.error(error);
          throw `An error happened with ${fileName} source!`;
        }),
      ),
    );
    console.log(response);
    const xmlData = response.data;
    const jsonData = await parseStringPromise(xmlData);
    const jsonFilePath = `${SOURCE_DIR}${fileName}.json`;
    const writeStream = createWriteStream(jsonFilePath);
    await unlink(jsonFilePath, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log('Successfully deleted the file.');
      }
    });
    writeStream.write(JSON.stringify(jsonData));
    this.logger.log(
      `Successfully get and write data to ${SOURCE_DIR}${fileName}.json`,
    );
    writeStream.end();
  }

  async saveJsonFromJson(downloadLink: string, fileName: string): Promise<any> {
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const response = await firstValueFrom(
      this.httpService.get(downloadLink).pipe(
        catchError((error) => {
          this.logger.error(error);
          throw `An error happened with ${fileName} source!`;
        }),
      ),
    );
    const jsonData = response.data;
    const jsonFilePath = `${SOURCE_DIR}${fileName}.json`;
    const writeStream = createWriteStream(jsonFilePath);
    await unlink(jsonFilePath, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log('Successfully deleted the file.');
      }
    });
    writeStream.write(JSON.stringify(jsonData));
    this.logger.log(
      `Successfully get and write data to ${SOURCE_DIR}${fileName}.json`,
    );
    writeStream.end();
  }

  formatDate(date: string) {
    const tmpDate = date.slice(0, 10).replace('T', ' ');
    if (date.length < 6 && date.length > 4) {
      return {
        day: null,
        month: null,
        year: null,
      };
    }
    if (date.length <= 4) {
      return {
        day: null,
        month: null,
        year: date,
      };
    }
    if (date.includes('/') || date.includes('-')) {
      const reg = /[-/\\]/;
      const tempDate = date.split(reg);

      if (date.length <= 7) {
        if (tempDate[0].length < 3) {
          return {
            day: null,
            month: tempDate[0],
            year: tempDate[1],
          };
        } else {
          return {
            day: null,
            month: tempDate[1],
            year: tempDate[0],
          };
        }
      } else {
        if (tempDate[0].length < 3) {
          return {
            day: tempDate[0],
            month: tempDate[1],
            year: tempDate[2],
          };
        } else {
          return {
            day: tempDate[2],
            month: tempDate[1],
            year: tempDate[0],
          };
        }
      }
    }
  }

  // DGT sanction from source
  async getSanctionDgt() {
    //get DGT file source
    const url = this.config.get('DGT_SOURCE');
    //request
    await this.saveJsonFromXml(url, 'liste_DGT');

    // const datePublication = data.Publications.DatePublication;
    // const cleanData = data.Publications.PublicationDetail.map((elt) => {
    //   const Details = elt.RegistreDetail;
    //   const type = elt.Nature;
    //   //santioned entity
    //   const entity = {
    //     id: this.transformId(elt.IdRegistre),
    //     listId: '101234567890123456789012',
    //     type: elt.Nature,
    //   };

    //   if (type == 'Personne physique') {
    //     entity['lastName'] = elt.Nom;
    //     entity['defaultName'] = elt.Nom;
    //   } else {
    //     entity['defaultName'] = elt.Nom;
    //     entity['original_name'] = elt.Nom;
    //   }
    //   //entity Details
    //   for (const prop of Details) {
    //     if (prop.TypeChamp == 'PRENOM') {
    //       let firstName = '';
    //       for (const elt of prop.Valeur) {
    //         firstName = firstName + ` ${elt.Prenom}`;
    //       }
    //       entity['defaultName'] = entity['defaultName'] + ` ${firstName}`;
    //       entity['firstName'] = firstName.trim();
    //     }

    //     if (prop.TypeChamp == 'SEXE') entity['sexe'] = prop.Valeur[0].Sexe;

    //     if (prop.TypeChamp == 'DATE_DE_NAISSANCE')
    //       entity['dateOfBirth'] = {
    //         day: prop.Valeur[0].Jour,
    //         month: prop.Valeur[0].Mois,
    //         year: prop.Valeur[0].Annee,
    //       };

    //     if (prop.TypeChamp == 'LIEU_DE_NAISSANCE')
    //       entity['placeOfBirth'] = {
    //         place: prop.Valeur[0].Lieu,
    //         country: prop.Valeur[0].Pays,
    //       };

    //     if (prop.TypeChamp == 'ADRESSE_PP')
    //       entity['adresse'] = {
    //         place: prop.Valeur[0].Adresse,
    //         country: prop.Valeur[0].Pays,
    //       };

    //     if (prop.TypeChamp == 'TITRE') {
    //       let title = '';
    //       for (const elt of prop.Valeur) {
    //         title = title + `- ${elt.Titre}`;
    //       }
    //       entity['title'] = title.trim();
    //     }

    //     if (prop.TypeChamp == 'MOTIFS') {
    //       let motive = '';
    //       for (const elt of prop.Valeur) {
    //         motive = motive + `- ${elt.Motifs}`;
    //       }
    //       entity['motive'] = motive.trim();
    //     }

    //     if (prop.TypeChamp == 'FONDEMENT_JURIDIQUE') {
    //       let reference = '';
    //       for (const elt of prop.Valeur) {
    //         reference =
    //           reference +
    //           `> ${elt.FondementJuridique} - ${elt.FondementJuridiqueLabel}`;
    //       }
    //       entity['reference'] = reference;
    //     }

    //     if (prop.TypeChamp == 'REFERENCE_UE') {
    //       let referenceUe = '';
    //       for (const elt of prop.Valeur) {
    //         referenceUe = referenceUe + `> ${elt.ReferenceUe}`;
    //       }
    //       entity['referenceUe'] = referenceUe;
    //     }

    //     if (prop.TypeChamp == 'REFERENCE_ONU') {
    //       let referenceOnu = '';
    //       for (const elt of prop.Valeur) {
    //         referenceOnu = referenceOnu + `> ${elt.ReferenceOnu}`;
    //       }
    //       entity['referenceOnu'] = referenceOnu;
    //     }

    //     if (prop.TypeChamp == 'ALIAS') {
    //       const alias = [];
    //       for (const elt of prop.Valeur) {
    //         alias.push({
    //           firstName: elt.Alias,
    //         });
    //       }
    //       entity['akas'] = alias;
    //     }

    //     if (prop.TypeChamp == 'NATIONALITE')
    //       entity['nationality'] = {
    //         country: prop.Valeur[0].Pays,
    //       };
    //   }

    //   return entity;
    // });

    // return {
    //   datePublication: datePublication,
    //   data: cleanData,
    // };
  }

  //OFAC SDN sanction from source
  // async getSanctionOFAC() {
  //   const url = this.config.get('OFAC_SOURCE');
  //   const { data } = await firstValueFrom(
  //     this.httpService.get(OFAC_URL).pipe(
  //       catchError((error: AxiosError) => {
  //         this.logger.error(error);
  //         throw 'An error happened with OFAC source!';
  //       }),
  //     ),
  //   );

  //   // parsing to json
  //   let jsonData;
  //   parseString(data, function (err, results) {
  //     // parsing to json
  //     jsonData = results;
  //   });

  //   const datePublication = jsonData.sdnList.publshInformation.Publish_Date;
  //   const cleanData = data.Publications.PublicationDetail.map((elt) => {
  //     const Details = elt.RegistreDetail;
  //     const type = elt.Nature;
  //     //santioned entity
  //     const entity = {
  //       id: this.transformId(elt.IdRegistre),
  //       listId: '101234567890123456789012',
  //       type: elt.Nature,
  //     };

  //     if (type == 'Personne physique') {
  //       entity['lastName'] = elt.Nom;
  //       entity['defaultName'] = elt.Nom;
  //     } else {
  //       entity['defaultName'] = elt.Nom;
  //       entity['original_name'] = elt.Nom;
  //     }
  //     //entity Details
  //     for (const prop of Details) {
  //       if (prop.TypeChamp == 'PRENOM') {
  //         let firstName = '';
  //         for (const elt of prop.Valeur) {
  //           firstName = firstName + ` ${elt.Prenom}`;
  //         }
  //         entity['defaultName'] = entity['defaultName'] + ` ${firstName}`;
  //         entity['firstName'] = firstName.trim();
  //       }

  //       if (prop.TypeChamp == 'SEXE') entity['sexe'] = prop.Valeur[0].Sexe;

  //       if (prop.TypeChamp == 'DATE_DE_NAISSANCE')
  //         entity['dateOfBirth'] = {
  //           day: prop.Valeur[0].Jour,
  //           month: prop.Valeur[0].Mois,
  //           year: prop.Valeur[0].Annee,
  //         };

  //       if (prop.TypeChamp == 'LIEU_DE_NAISSANCE')
  //         entity['placeOfBirth'] = {
  //           place: prop.Valeur[0].Lieu,
  //           country: prop.Valeur[0].Pays,
  //         };

  //       if (prop.TypeChamp == 'ADRESSE_PP')
  //         entity['adresse'] = {
  //           place: prop.Valeur[0].Adresse,
  //           country: prop.Valeur[0].Pays,
  //         };

  //       if (prop.TypeChamp == 'TITRE') {
  //         let title = '';
  //         for (const elt of prop.Valeur) {
  //           title = title + `- ${elt.Titre}`;
  //         }
  //         entity['title'] = title.trim();
  //       }

  //       if (prop.TypeChamp == 'MOTIFS') {
  //         let motive = '';
  //         for (const elt of prop.Valeur) {
  //           motive = motive + `- ${elt.Motifs}`;
  //         }
  //         entity['motive'] = motive.trim();
  //       }

  //       if (prop.TypeChamp == 'FONDEMENT_JURIDIQUE') {
  //         let reference = '';
  //         for (const elt of prop.Valeur) {
  //           reference =
  //             reference +
  //             `> ${elt.FondementJuridique} - ${elt.FondementJuridiqueLabel}`;
  //         }
  //         entity['reference'] = reference;
  //       }

  //       if (prop.TypeChamp == 'REFERENCE_UE') {
  //         let referenceUe = '';
  //         for (const elt of prop.Valeur) {
  //           referenceUe = referenceUe + `> ${elt.ReferenceUe}`;
  //         }
  //         entity['referenceUe'] = referenceUe;
  //       }

  //       if (prop.TypeChamp == 'REFERENCE_ONU') {
  //         let referenceOnu = '';
  //         for (const elt of prop.Valeur) {
  //           referenceOnu = referenceOnu + `> ${elt.ReferenceOnu}`;
  //         }
  //         entity['referenceOnu'] = referenceOnu;
  //       }

  //       if (prop.TypeChamp == 'ALIAS') {
  //         const alias = [];
  //         for (const elt of prop.Valeur) {
  //           alias.push({
  //             firstName: elt.Alias,
  //           });
  //         }
  //         entity['akas'] = alias;
  //       }

  //       if (prop.TypeChamp == 'NATIONALITE')
  //         entity['nationality'] = {
  //           country: prop.Valeur[0].Pays,
  //         };
  //     }

  //     return entity;
  //   });

  //   return {
  //     datePublication: datePublication,
  //     data: cleanData,
  //   };

  //   // display the json data
  //   return jsonData;
  // }
  //OFAC sanction from source
  async getSanctionOfac() {
    const url = this.config.get('OFAC_SOURCE');
    //request
    await this.saveJsonFromXml(url, 'liste_OFAC');
  }

  //United Nation sanction from source
  async getSanctionUn() {
    const url = this.config.get('UN_SOURCE');
    //request
    await this.saveJsonFromXml(url, 'liste_UN');
  }

  //Canada sanction from source
  async getSanctionCa() {
    const url = this.config.get('CA_SOURCE');
    //request
    await this.saveJsonFromXml(url, 'liste_CA');
  }

  //United Nation sanction from source
  async getSanctionGbHmt() {
    const url = this.config.get('GB_HMT_SOURCE');
    //request
    await this.saveJsonFromXml(url, 'liste_GB');
  }

  //United Nation sanction from source
  async getSanctionSeco() {
    const url = this.config.get('SECO_SOURCE');
    //request
    await this.saveJsonFromXml(url, 'liste_SECO');
  }
}
