import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { parseStringPromise } from 'xml2js';
import { createWriteStream, unlink } from 'fs';
import { getName, getAlpha2Code } from 'i18n-iso-countries';

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
    if (tempId.length < 24) {
      const length = 24 - tempId.length;

      for (let i = 0; i < length; i++) {
        if (count > 9) count = 0;
        tempId += count;
        count++;
      }
      return tempId;
    } else {
      return tempId.slice(0, 24);
    }
  }
  //transform id algorithm
  cleanDate(date: string): string {
    const regex = /[A-Za-z]/g;
    date = date.replace(regex, '');
    const dateT = date.split(' ');
    const tempDate = dateT.filter((item) => {
      return item.length > 1;
    });
    return tempDate.join('-');
  }

  formatDate(date: string) {
    const message = `${date} is Invalid date`;
    if (date.length < 4) {
      throw message;
    }
    const reg = /[-/\\]/;
    if (date.includes('/') || date.includes('-')) {
      const tempDate = date.slice(0, 10).split(reg);
      if (date.length <= 7) {
        if (tempDate[0].length < 3) {
          return {
            month: tempDate[0],
            year: tempDate[1],
          };
        } else {
          return {
            month: tempDate[1],
            year: tempDate[0],
          };
        }
      } else {
        if (tempDate[1].length > 3) {
          return {
            year: tempDate[1],
          };
        } else if (tempDate[0].length < 3) {
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
    return {
      year: date,
    };
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

  async downloadData(fileName: string) {
    const downloadLink =
      'http://localhost:3000/api/migration/download/' + fileName;
    const response = await firstValueFrom(
      this.httpService.get(downloadLink).pipe(
        catchError((error) => {
          this.logger.error(error);
          throw `An error happened with ${downloadLink}!`;
        }),
      ),
    );
    const jsonData = response.data;
    return jsonData;
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
    writeStream.write(JSON.stringify(jsonData));
    this.logger.log(
      `Successfully get and write data to ${SOURCE_DIR}${fileName}.json`,
    );
    writeStream.end();
  }

  // International Trade Administration sanction source
  async getSanctionIta() {
    this.logger.log('====== Getting Sanstion From ITA Source...');
    const url = this.config.get('ITA_SOURCE');
    //request
    await this.saveJsonFromJson(url, 'liste_ITA');
  }

  async getSanctionDgt() {
    this.logger.log('====== Getting Sanction From DGT Source...');
    const url = this.config.get('DGT_SOURCE');
    //request
    await this.saveJsonFromJson(url, 'liste_DGT');
  }

  // Iternational Trade Administration
  async mapSanctionIta() {
    this.logger.log('====== Mapping Cleaning & Saving data From ITA Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataIat = await this.downloadData('liste_ITA.json');

    const lists = [
      {
        id: 1,
        liste: 'Capta List (CAP) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/list-of-foreign-financial-institutions-subject-to-correspondent-account-or-payable-through-account-sanctions-capta-list',
      },
      {
        id: 2,
        liste:
          'Non-SDN Chinese Military-Industrial Complex Companies List (CMIC) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/ns-cmic-list',
      },
      {
        id: 3,
        liste: 'Denied Persons List (DPL) - Bureau of Industry and Security',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/ns-cmic-list',
      },
      {
        id: 4,
        liste: 'ITAR Debarred (DTC) - State Department',
        link: 'https://www.pmddtc.state.gov/ddtc_public?id=ddtc_kb_article_page&sys_id=c22d1833dbb8d300d0a370131f9619f0',
      },
      {
        id: 5,
        liste: 'Entity List (EL) - Bureau of Industry and Security',
        link: 'https://www.pmddtc.state.gov/ddtc_public?id=ddtc_kb_article_page&sys_id=c22d1833dbb8d300d0a370131f9619f0',
      },
      {
        id: 6,
        liste: 'Foreign Sanctions Evaders (FSE) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/foreign-sanctions-evaders-fse-list',
      },
      {
        id: 7,
        liste: 'Nonproliferation Sanctions (ISN) - State Department',
        link: 'https://www.state.gov/key-topics-bureau-of-international-security-and-nonproliferation/nonproliferation-sanctions/',
      },
      {
        id: 8,
        liste:
          'Non-SDN Menu-Based Sanctions List (NS-MBS List) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/non-sdn-menu-based-sanctions-list-ns-mbs-list',
      },
      {
        id: 9,
        liste: 'Military End User (MEU) List - Bureau of Industry and Security',
        link: 'https://www.bis.doc.gov/index.php/policy-guidance/lists-of-parties-of-concern',
      },
      {
        id: 10,
        liste:
          'Palestinian Legislative Council List (PLC) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/non-sdn-palestinian-legislative-council-ns-plc-list',
      },
      {
        id: 11,
        liste: 'Specially Designated Nationals (SDN) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists',
      },
      {
        id: 12,
        liste:
          'Sectoral Sanctions Identifications List (SSI) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/sectoral-sanctions-identifications-ssi-list',
      },
      {
        id: 13,
        liste: 'Unverified List (UVL) - Bureau of Industry and Security',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/sectoral-sanctions-identifications-ssi-list',
      },
    ];

    const sources: any = dataIat.sources_used;
    const cleanSource = sources.map((item) => {
      let listUrl;
      let id;
      lists.forEach((element) => {
        if (item.source == element.liste) {
          listUrl = element.link;
          id = element.id;
        }
      });
      return {
        id: this.transformId(id),
        name: item.source,
        sourceUrl: listUrl,
        importRate: item.import_rate,
        lastImported: item.last_imported,
        publicationDate: item.source_last_updated,
      };
    });

    return cleanSource;
  }

  // Sanctions financières internationales
  async mapSanctionDgt() {
    this.logger.log('====== Mapping Cleaning & Saving data From DGT Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataDgt = await this.downloadData('liste_DGT.json');

    const list = {
      id: this.transformId(14),
      name: 'National Register of Gels (DGT) - Directorate of the Treasury',
      sourceUrl: 'https://gels-avoirs.dgtresor.gouv.fr/List',
      importRate: 'Hourly',
      lastImported: dataDgt.Publications.DatePublication,
      publicationDate: dataDgt.Publications.DatePublication,
    };

    const sources: any = dataDgt.Publications.PublicationDetail;
    const cleanSource = sources.map((item) => {
      const entity = {
        id: this.transformId(item.IdRegistre),
        defaultName: item.Nom,
        listId: '140123456789012345678901',
        othersInfos: [],
        references: [],
        addresses: [],
      };
      let othersInfos = [];
      //type
      if (item.Nature) {
        if (item.Nature == 'Personne physique') entity['type'] = 'Individual';
        if (item.Nature == 'Personne morale') entity['type'] = 'Entity';
      }
      const details = item.RegistreDetail;

      details.forEach((detail) => {
        //names
        if (detail.TypeChamp == 'PRENOM') {
          entity['lastName'] = item.Nom;
          entity['firstName'] = detail.Valeur[0].Prenom;
          entity['defaultName'] =
            entity['defaultName'] + ' ' + entity['firstName'];
        }
        //gender
        if (detail.TypeChamp == 'SEXE') {
          if (detail.Valeur[0].Sexe == 'Masculin') entity['gender'] = 'Male';
          if (detail.Valeur[0].Sexe == 'Féminin') entity['gender'] = 'Female';
        }
        //akas
        if (detail.TypeChamp == 'ALIAS') {
          const akas = [];
          detail.Valeur.forEach((aka) => {
            akas.push(aka.Alias);
          });
          entity['akas'] = akas;
        }
        //remarks
        if (detail.TypeChamp == 'MOTIFS')
          entity['remarks'] = detail.Valeur[0].Motifs;
        //dateOfBirth
        if (detail.TypeChamp == 'DATE_DE_NAISSANCE') {
          const date = {};
          if (detail.Valeur[0].Jour != '') date['day'] = detail.Valeur[0].Jour;
          if (detail.Valeur[0].Mois != '')
            date['month'] = detail.Valeur[0].Mois;
          if (detail.Valeur[0].Annee != '')
            date['year'] = detail.Valeur[0].Annee;
          entity['dateOfBirth'] = date;
        }
        //placeOfBirth
        if (detail.TypeChamp == 'LIEU_DE_NAISSANCE') {
          const data = { place: detail.Valeur[0].Lieu };
          if (detail.Valeur[0].Pays != '')
            data['country'] = {
              name: detail.Valeur[0].Pays,
              isoCode: getAlpha2Code(detail.Valeur[0].Pays, 'fr'),
            };
          entity['placeOfBirth'] = data;
        }
        //title
        if (detail.TypeChamp == 'TITRE') {
          entity['title'] = detail.Valeur[0].Titre;
          if (detail.Valeur.length > 1) {
            const data = detail.Valeur;
            const tmpArray = data.map((elt) => {
              return {
                value: elt.Titre,
                type: 'otherTitle',
              };
            });
            othersInfos = othersInfos.concat(tmpArray);
          }
        }
        //programs
        const programs = [];
        if (detail.TypeChamp == 'REFERENCE_UE') {
          detail.Valeur.forEach((ref) => {
            programs.push(ref.ReferenceUe);
          });
        }
        if (detail.TypeChamp == 'REFERENCE_ONU') {
          detail.Valeur.forEach((ref) => {
            programs.push(ref.ReferenceOnu);
          });
        }
        entity['programs'] = programs;
        //references
        const references = [];
        if (detail.TypeChamp == 'FONDEMENT_JURIDIQUE') {
          detail.Valeur.forEach((ref) => {
            references.push(
              `${ref.FondementJuridique} - ${ref.FondementJuridiqueLabel}`,
            );
          });
        }
        entity['references'] = references;

        //addresses
        if (detail.TypeChamp == 'ADRESSE_PM') {
          const data = {};
          if (detail.Valeur[0].Adresse != '')
            data['place'] = detail.Valeur[0].Adresse;
          if (detail.Valeur[0].Pays != '')
            data['country'] = {
              name: detail.Valeur[0].Pays,
              isoCode: getAlpha2Code(detail.Valeur[0].Pays, 'fr'),
            };
          entity.addresses = [data];
        }

        //nationalities
        if (detail.TypeChamp == 'NATIONALITE') {
          const data = { country: detail.Valeur[0].Pays };
          data['isoCode'] = getAlpha2Code(detail.Valeur[0].Pays, 'fr');
          entity['nationalities'] = [data];
        }
        //othersInfos
        if (detail.TypeChamp == 'AUTRE_IDENTITE') {
          const data = {
            value: detail.Valeur[0].NumeroCarte,
            type: 'CardNumber',
          };
          if (detail.Valeur[0].Commentaire != '')
            data['comment'] = detail.Valeur[0].Commentaire;
          othersInfos.push(data);
        }

        if (detail.TypeChamp == 'PASSEPORT') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              comment: elt.Commentaire,
              value: elt.NumeroPasseport,
              type: 'Passport',
            });
          });
        }

        if (detail.TypeChamp == 'TELEPHONE') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              value: elt.Telephone,
              type: 'PhoneNumber',
            });
          });
        }

        if (detail.TypeChamp == 'SITE_INTERNET') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              value: elt.SiteInternet,
              type: 'WebSite',
            });
          });
        }

        if (detail.TypeChamp == 'COURRIEL') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              value: elt.Courriel,
              type: 'Mail',
            });
          });
        }

        if (detail.TypeChamp == 'NUMERO_OMI') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              value: elt.NumeroOMI,
              type: 'NumeroOmi',
            });
          });
        }

        if (detail.TypeChamp == 'IDENTIFICATION') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              comment: elt.Commentaire,
              value: elt.Identification,
              type: 'Identification',
            });
          });
        }

        if (detail.TypeChamp == 'CRYPTOMONNAIE') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              comment: elt.Commentaire,
              value: elt.Cryptomonnaie,
              type: 'Crypto',
            });
          });
        }
      });
      entity['othersInfos'] = othersInfos;
      return entity;
    });

    const finalData = { list: list, result: cleanSource };
    const sourceLinkFile = `${SOURCE_DIR}clean_DGT.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(finalData));
    writeStream.end();
  }

  //map and save sanction into file
  async mapSanction() {
    this.logger.log('====== Mapping Cleaning & Saving data From ITA Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataIat = await this.downloadData('liste_ITA.json');

    const lists = [
      {
        id: 1,
        liste: 'Capta List (CAP) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/list-of-foreign-financial-institutions-subject-to-correspondent-account-or-payable-through-account-sanctions-capta-list',
      },
      {
        id: 2,
        liste:
          'Non-SDN Chinese Military-Industrial Complex Companies List (CMIC) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/ns-cmic-list',
      },
      {
        id: 3,
        liste: 'Denied Persons List (DPL) - Bureau of Industry and Security',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/ns-cmic-list',
      },
      {
        id: 4,
        liste: 'ITAR Debarred (DTC) - State Department',
        link: 'https://www.pmddtc.state.gov/ddtc_public?id=ddtc_kb_article_page&sys_id=c22d1833dbb8d300d0a370131f9619f0',
      },
      {
        id: 5,
        liste: 'Entity List (EL) - Bureau of Industry and Security',
        link: 'https://www.pmddtc.state.gov/ddtc_public?id=ddtc_kb_article_page&sys_id=c22d1833dbb8d300d0a370131f9619f0',
      },
      {
        id: 6,
        liste: 'Foreign Sanctions Evaders (FSE) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/foreign-sanctions-evaders-fse-list',
      },
      {
        id: 7,
        liste: 'Nonproliferation Sanctions (ISN) - State Department',
        link: 'https://www.state.gov/key-topics-bureau-of-international-security-and-nonproliferation/nonproliferation-sanctions/',
      },
      {
        id: 8,
        liste:
          'Non-SDN Menu-Based Sanctions List (NS-MBS List) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/non-sdn-menu-based-sanctions-list-ns-mbs-list',
      },
      {
        id: 9,
        liste: 'Military End User (MEU) List - Bureau of Industry and Security',
        link: 'https://www.bis.doc.gov/index.php/policy-guidance/lists-of-parties-of-concern',
      },
      {
        id: 10,
        liste:
          'Palestinian Legislative Council List (PLC) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/non-sdn-palestinian-legislative-council-ns-plc-list',
      },
      {
        id: 11,
        liste: 'Specially Designated Nationals (SDN) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists',
      },
      {
        id: 12,
        liste:
          'Sectoral Sanctions Identifications List (SSI) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/sectoral-sanctions-identifications-ssi-list',
      },
      {
        id: 13,
        liste: 'Unverified List (UVL) - Bureau of Industry and Security',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/sectoral-sanctions-identifications-ssi-list',
      },
    ];

    const sources: any = dataIat.sources_used;
    const cleanSource = sources.map((item) => {
      let listUrl;
      let id;
      lists.forEach((element) => {
        if (item.source == element.liste) {
          listUrl = element.link;
          id = element.id;
        }
      });
      return {
        id: this.transformId(id),
        name: item.source,
        sourceUrl: listUrl,
        importRate: item.import_rate,
        lastImported: item.last_imported,
        publicationDate: item.source_last_updated,
      };
    });

    const sourceLinkFile = `${SOURCE_DIR}source_link.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(cleanSource));
    writeStream.end();
  }

  //map and save sanction into file
  async mapSanctioned() {
    this.logger.log('====== Mapping Cleaning & Saving data From ITA Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    //read file contents
    const dataIat = await this.downloadData('liste_ITA.json');
    const lists = await this.downloadData('source_link.json');

    const sources: any = dataIat.results;
    //map
    const cleanSource = sources.map((item) => {
      const entity = {
        defaultName: item.name,
      };
      //### list id
      lists.forEach((element) => {
        if (item.source == element.name) {
          entity['listId'] = element.id;
        }
      });
      //### gender
      if (item.ids) {
        item.ids.forEach((elt) => {
          if (elt.type == 'Gender') entity['gender'] = elt.number;
        });
      }
      //### type
      if (item.type) entity['type'] = item.type;
      //### akas
      if (item.alt_names) entity['akas'] = item.alt_names;
      //### date of birth
      if (
        item.dates_of_birth &&
        item.dates_of_birth != null &&
        item.dates_of_birth.length > 0
      ) {
        if (typeof item.dates_of_birth == 'string') {
          const date = this.cleanDate(item.dates_of_birth);
          entity['dateOfBirth'] = this.formatDate(date);
        } else {
          const date = this.cleanDate(item.dates_of_birth[0]);
          entity['dateOfBirth'] = this.formatDate(date);
        }
      }
      //### place of birth
      if (
        item.places_of_birth &&
        item.places_of_birth != null &&
        item.places_of_birth.length > 0
      )
        entity['placeOfBirth'] = {
          place: item.places_of_birth[0],
        };
      //### title
      if (item.title && item.title != null) {
        entity['title'] = item.title;
      }

      //### remarks
      if (item.remarks && item.remarks != null) {
        entity['remarks'] = item.remarks;
      }

      //### program
      if (item.programs && item.programs != null && item.programs.length > 0) {
        entity['programs'] = item.programs;
      }

      //### references
      const references = [];
      //federal register notice
      if (item.federal_register_notice && item.federal_register_notice != null)
        references.push(item.federal_register_notice);
      //license policy
      if (item.license_policy && item.license_policy != null)
        references.push(item.license_policy);
      //gross tonnage
      if (item.gross_tonnage && item.gross_tonnage != null)
        references.push(`gross tonnage - ${item.license_policy}`);
      //license policy
      if (item.license_policy && item.license_policy != null)
        references.push(item.license_policy);
      //license requirement
      if (item.license_requirement && item.license_requirement != null)
        references.push(item.license_requirement);
      entity['references'] = references;

      //### publication url
      if (item.source_list_url && item.source_list_url != null) {
        entity['publicationUrl'] = item.source_list_url;
      }

      //### addresses
      if (item.addresses) {
        const addresses = item.addresses.map((address) => {
          return {
            place: address.address,
            stateOrProvince: address.state,
            postalCode: address.postal_code,
            country: {
              isoCode: address.country,
              name: getName(address.country, 'en'),
            },
          };
        });
        entity['addresses'] = addresses;
      }
      //### nationalities
      if (
        item.nationalities &&
        item.nationalities != null &&
        item.nationalities.length > 0
      ) {
        const nationalities = item.nationalities.map((elt) => {
          return {
            isoCode: elt,
            country: getName(elt, 'en'),
          };
        });
        entity['nationalities'] = nationalities;
      }

      //### citizenships
      if (
        item.citizenships &&
        item.citizenships != null &&
        item.citizenships.length > 0
      ) {
        const citizenships = item.citizenships.map((elt) => {
          return {
            isoCode: elt,
            country: getName(elt, 'en'),
          };
        });
        entity['citizenships'] = citizenships;
      }

      //### others infos
      if (item.ids && item.ids != null && item.ids.length > 0) {
        entity['othersInfos'] = item.ids.map((elt) => {
          return {
            type: elt.type,
            value: elt.number,
            issueDate: elt.issue_date,
            expirationDate: elt.expiration_date,
          };
        });
        //verssel flag
        if (item.vessel_flag && item.vessel_flag != null)
          entity['othersInfos'].push({
            type: 'vesselFlag',
            value: item.vessel_flag,
            issueDate: null,
            expirationDate: null,
          });
        //vessel owner
        if (item.vessel_owner && item.vessel_owner != null)
          entity['othersInfos'].push({
            type: 'vesselOwner',
            value: item.vessel_owner,
            issueDate: null,
            expirationDate: null,
          });
        //vessel type
        if (item.vessel_type && item.vessel_type != null)
          entity['othersInfos'].push({
            type: 'vesselType',
            value: item.vessel_type,
            issueDate: null,
            expirationDate: null,
          });
        //start_date
        if (item.start_date && item.start_date != null)
          entity['othersInfos'].push({
            type: 'startDate',
            value: item.start_date,
            issueDate: null,
            expirationDate: null,
          });
        //end_date
        if (item.end_date && item.end_date != null)
          entity['othersInfos'].push({
            type: 'endDate',
            value: item.end_date,
            issueDate: null,
            expirationDate: null,
          });
        //call sign
        if (item.call_sign && item.call_sign != null)
          entity['othersInfos'].push({
            type: 'callSign',
            value: item.call_sign,
            issueDate: null,
            expirationDate: null,
          });
      }

      return entity;
    });

    const sourceLinkFile = `${SOURCE_DIR}clean_source.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(cleanSource));
    writeStream.end();
  }
}
