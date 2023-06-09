import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { parseStringPromise } from 'xml2js';
import { createReadStream, createWriteStream, readFileSync, unlink } from 'fs';
import { getName, getAlpha2Code } from 'i18n-iso-countries';
import { createInterface } from 'readline';

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

  //clean date in some case for exemple when it contains alphabetics
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
    const options = {
      normalizeTags: true,
      explicitArray: false,
      attrkey: 'value',
    };
    const jsonData = await parseStringPromise(xmlData, options);
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

  // International Trade Administration sanction source
  async getSanctionIta() {
    this.logger.log('====== Getting Sanstion From ITA Source...');
    const url = this.config.get('ITA_SOURCE');
    //request
    await this.saveJsonFromJson(url, 'liste_ITA');
  }

  async mapSanctionIta() {
    this.logger.log('====== Mapping Cleaning & Saving data From ITA Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataIat = await this.downloadData('liste_ITA.json');

    //==== ---- Lists ---- ====
    const sourceList = dataIat.sources_used;
    const links = [
      {
        id: 30,
        liste: 'Capta List (CAP) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/list-of-foreign-financial-institutions-subject-to-correspondent-account-or-payable-through-account-sanctions-capta-list',
      },
      {
        id: 31,
        liste:
          'Non-SDN Chinese Military-Industrial Complex Companies List (CMIC) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/ns-cmic-list',
      },
      {
        id: 32,
        liste: 'Denied Persons List (DPL) - Bureau of Industry and Security',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/ns-cmic-list',
      },
      {
        id: 33,
        liste: 'ITAR Debarred (DTC) - State Department',
        link: 'https://www.pmddtc.state.gov/ddtc_public?id=ddtc_kb_article_page&sys_id=c22d1833dbb8d300d0a370131f9619f0',
      },
      {
        id: 34,
        liste: 'Entity List (EL) - Bureau of Industry and Security',
        link: 'https://www.pmddtc.state.gov/ddtc_public?id=ddtc_kb_article_page&sys_id=c22d1833dbb8d300d0a370131f9619f0',
      },
      {
        id: 35,
        liste: 'Foreign Sanctions Evaders (FSE) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/foreign-sanctions-evaders-fse-list',
      },
      {
        id: 36,
        liste: 'Nonproliferation Sanctions (ISN) - State Department',
        link: 'https://www.state.gov/key-topics-bureau-of-international-security-and-nonproliferation/nonproliferation-sanctions/',
      },
      {
        id: 37,
        liste:
          'Non-SDN Menu-Based Sanctions List (NS-MBS List) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/non-sdn-menu-based-sanctions-list-ns-mbs-list',
      },
      {
        id: 38,
        liste: 'Military End User (MEU) List - Bureau of Industry and Security',
        link: 'https://www.bis.doc.gov/index.php/policy-guidance/lists-of-parties-of-concern',
      },
      {
        id: 39,
        liste:
          'Palestinian Legislative Council List (PLC) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/non-sdn-palestinian-legislative-council-ns-plc-list',
      },
      {
        id: 391,
        liste: 'Specially Designated Nationals (SDN) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists',
      },
      {
        id: 392,
        liste:
          'Sectoral Sanctions Identifications List (SSI) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/sectoral-sanctions-identifications-ssi-list',
      },
      {
        id: 393,
        liste: 'Unverified List (UVL) - Bureau of Industry and Security',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/sectoral-sanctions-identifications-ssi-list',
      },
    ];
    const lists = sourceList.map((item) => {
      const data = {
        name: item.source,
        importRate: 'Hourly',
        lastImported: item.last_imported,
        publicationDate: item.source_last_updated,
      };
      for (const elt of links) {
        if (elt.liste == item.source) {
          data['id'] = this.transformId(elt.id);
          data['sourceUrl'] = elt.link;
        }
      }
      return data;
    });

    //==== ---- Sanctioned Data ---- ====
    const sourceResult = dataIat.results;
    const cleanSource = sourceResult.map((item) => {
      const entity = {
        defaultName: item.name,
      };
      //==== list id
      lists.forEach((elt) => {
        if (item.source == elt.name) {
          entity['listId'] = elt.id;
        }
      });
      //==== gender
      if (item.ids) {
        item.ids.forEach((elt) => {
          if (elt.type == 'Gender') entity['gender'] = elt.number;
        });
      }
      //==== type
      if (item.type) entity['type'] = item.type;
      //==== akas
      if (item.alt_names) entity['akas'] = item.alt_names;
      //==== date of birth
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
      //==== place of birth
      if (
        item.places_of_birth &&
        item.places_of_birth != null &&
        item.places_of_birth.length > 0
      )
        entity['placeOfBirth'] = {
          place: item.places_of_birth[0],
        };
      //==== title
      if (item.title && item.title != null) {
        entity['title'] = item.title;
      }

      //==== remarks
      if (item.remarks && item.remarks != null) {
        entity['remarks'] = item.remarks;
      }

      //==== program
      if (item.programs && item.programs != null && item.programs.length > 0) {
        entity['programs'] = item.programs;
      }

      //==== references
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

      //==== publication url
      if (item.source_list_url && item.source_list_url != null) {
        entity['publicationUrl'] = item.source_list_url;
      }

      //==== addresses
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
      //==== nationalities
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

      //==== citizenships
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

      //==== others infos
      if (item.ids && item.ids != null && item.ids.length > 0) {
        entity['othersInfos'] = item.ids.map((elt) => {
          const data = {
            type: elt.type,
            value: elt.number,
            issueDate: elt.issue_date,
            expirationDate: elt.expiration_date,
          };

          if (elt.country && elt.country != '' && elt.country != null)
            data['comment'] = getName(elt.country, 'en');
          return data;
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

    const finalData = {
      lists: lists,
      results: cleanSource,
      total: cleanSource.length,
    };

    if (finalData.lists && finalData.results)
      this.logger.log('(success !) all is well');

    const sourceLinkFile = `${SOURCE_DIR}clean_ITA.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(finalData));
    writeStream.end();
  }

  //Direction General du Tresor
  async getSanctionDgt() {
    this.logger.log('====== Getting Sanction From DGT Source...');
    const url = this.config.get('DGT_SOURCE');
    //request
    await this.saveJsonFromJson(url, 'liste_DGT');
  }
  async mapSanctionDgt() {
    this.logger.log('====== Mapping Cleaning & Saving data From DGT Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataDgt = await this.downloadData('liste_DGT.json');

    const list = [
      {
        id: this.transformId(10),
        name: 'National Register of Gels (DGT) - FR Directorate of the Treasury',
        sourceUrl: 'https://gels-avoirs.dgtresor.gouv.fr/List',
        importRate: 'Hourly',
        lastImported: dataDgt.Publications.DatePublication,
        publicationDate: dataDgt.Publications.DatePublication,
      },
    ];

    const sources: any = dataDgt.Publications.PublicationDetail;
    const cleanSource = sources.map((item) => {
      const entity = {
        id: this.transformId(item.IdRegistre),
        defaultName: item.Nom,
        listId: list[0].id,
        othersInfos: [],
        references: [],
        addresses: [],
      };
      let othersInfos = [];
      //==== type
      if (item.Nature) {
        if (item.Nature == 'Personne physique') entity['type'] = 'Individual';
        if (item.Nature == 'Personne morale') entity['type'] = 'Entity';
      }
      const details = item.RegistreDetail;

      details.forEach((detail) => {
        //==== names
        if (detail.TypeChamp == 'PRENOM') {
          entity['lastName'] = item.Nom;
          entity['firstName'] = detail.Valeur[0].Prenom;
          entity['defaultName'] =
            entity['defaultName'] + ' ' + entity['firstName'];
        }
        //==== gender
        if (detail.TypeChamp == 'SEXE') {
          if (detail.Valeur[0].Sexe == 'Masculin') entity['gender'] = 'Male';
          if (detail.Valeur[0].Sexe == 'Féminin') entity['gender'] = 'Female';
        }
        //==== akas
        if (detail.TypeChamp == 'ALIAS') {
          const akas = [];
          detail.Valeur.forEach((aka) => {
            akas.push(aka.Alias);
          });
          entity['akas'] = akas;
        }
        //==== remarks
        if (detail.TypeChamp == 'MOTIFS')
          entity['remarks'] = detail.Valeur[0].Motifs;
        //==== dateOfBirth
        if (detail.TypeChamp == 'DATE_DE_NAISSANCE') {
          const date = {};
          if (detail.Valeur[0].Jour != '') date['day'] = detail.Valeur[0].Jour;
          if (detail.Valeur[0].Mois != '')
            date['month'] = detail.Valeur[0].Mois;
          if (detail.Valeur[0].Annee != '')
            date['year'] = detail.Valeur[0].Annee;
          entity['dateOfBirth'] = date;
        }
        //==== placeOfBirth
        if (detail.TypeChamp == 'LIEU_DE_NAISSANCE') {
          const data = { place: detail.Valeur[0].Lieu };
          if (detail.Valeur[0].Pays != '')
            data['country'] = {
              name: detail.Valeur[0].Pays,
              isoCode: getAlpha2Code(detail.Valeur[0].Pays, 'fr'),
            };
          entity['placeOfBirth'] = data;
        }
        //==== title
        if (detail.TypeChamp == 'TITRE') {
          entity['title'] = detail.Valeur[0].Titre;
          if (detail.Valeur.length > 1) {
            const data = detail.Valeur;
            const tmpArray = data.map((elt) => {
              return {
                value: elt.Titre,
                type: 'OtherTitle',
              };
            });
            othersInfos = othersInfos.concat(tmpArray);
          }
        }
        //==== programs
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
        //==== references
        const references = [];
        if (detail.TypeChamp == 'FONDEMENT_JURIDIQUE') {
          detail.Valeur.forEach((ref) => {
            references.push(
              `${ref.FondementJuridique} - ${ref.FondementJuridiqueLabel}`,
            );
          });
        }
        entity['references'] = references;

        //==== addresses
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

        //==== nationalities
        if (detail.TypeChamp == 'NATIONALITE') {
          const data = { country: detail.Valeur[0].Pays };
          data['isoCode'] = getAlpha2Code(detail.Valeur[0].Pays, 'fr');
          entity['nationalities'] = [data];
        }
        //==== othersInfos
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
              type: 'OmiNumber',
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

    const finalData = {
      lists: list,
      results: cleanSource,
      total: cleanSource.length,
    };

    if (finalData.lists && finalData.results)
      this.logger.log('(success !) all is well');

    const sourceLinkFile = `${SOURCE_DIR}clean_DGT.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(finalData));
    writeStream.end();
  }

  //conseil de securite des nations unies
  async getSanctionUn() {
    this.logger.log('====== Getting Sanction From UN Source...');
    const url = this.config.get('UN_SOURCE');
    //request
    await this.saveJsonFromXml(url, 'liste_UN');
  }
  async mapSanctionUn() {
    this.logger.log('====== Mapping Cleaning & Saving data From UN Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataUn = await this.downloadData('liste_UN.json');

    const list = [
      {
        id: this.transformId(11),
        name: 'UN List (UN) - United Nations Security Council',
        sourceUrl:
          'https://www.un.org/securitycouncil/fr/content/un-sc-consolidated-list',
        importRate: 'Hourly',
        lastImported: dataUn.consolidated_list.value.dateGenerated,
        publicationDate: dataUn.consolidated_list.value.dateGenerated,
      },
    ];

    const sources: any = dataUn.consolidated_list.individuals;
    const sources2: any = dataUn.consolidated_list.entities;
    //=====---- Map Individuals ----=========
    const individuals = sources.individual;
    const cleanIndividual = individuals.map((item) => {
      const entity = {
        id: this.transformId(item.dataid),
        type: 'Individual',
        listId: list[0].id,
        othersInfos: [],
        references: [],
        addresses: [],
      };
      let othersInfos = [];
      //====names
      let defaultName = '';
      if (item.third_name) {
        defaultName = item.third_name;
      }
      if (item.second_name) {
        entity['lastName'] = item.second_name;
        defaultName = (defaultName + ' ' + entity['lastName']).trim();
      }
      if (item.first_name) {
        entity['firstName'] = item.first_name;
        defaultName = (defaultName + ' ' + entity['firstName']).trim();
      }
      entity['defaultName'] = defaultName;

      //===gender
      if (item.gender && item.gender !== 'Unknown' && item.gender !== '') {
        entity['gender'] = item.gender;
      }
      //====akas
      const akas = [];
      if (item.individual_alias) {
        if (item.individual_alias instanceof Array) {
          item.individual_alias.forEach((aka) => {
            if (aka.alias_name !== '') akas.push(aka.alias_name);
          });
        } else {
          if (item.individual_alias.alias_name !== '')
            akas.push(item.individual_alias.alias_name);
        }
      }
      if (item.name_original_script) akas.push(item.name_original_script);
      entity['akas'] = akas;
      //====remarks
      if (item.comments1 && item.comments1 !== '')
        entity['remarks'] = item.comments1;

      //====dateOfBirth
      if (
        item.individual_date_of_birth &&
        item.individual_date_of_birth !== ''
      ) {
        const dates = item.individual_date_of_birth;
        if (item.individual_date_of_birth instanceof Array) {
          //others infos
          const cleandates = dates.map((elt) => {
            let dateComment = `${elt.type_of_date}`;
            let dateValue;
            if (elt.date) dateValue = elt.date;
            if (elt.year) dateValue = elt.year;
            if (elt.note) dateComment = `${elt.type_of_date} - ${elt.note}`;
            return {
              comment: dateComment,
              value: dateValue,
              type: 'OtherBirthDate',
            };
          });
          othersInfos = othersInfos.concat(cleandates);
          //set date of birth
          if (dates[0].year) {
            entity['dateOfBirth'] = { year: dates[0].year };
          }
          if (dates[0].date) {
            const date = this.formatDate(dates[0].date);
            entity['dateOfBirth'] = date;
          }
        } else {
          //set date of birth
          if (dates.year) entity['dateOfBirth'] = { year: dates.year };
          if (dates.date) {
            const date = this.formatDate(dates.date);
            entity['dateOfBirth'] = date;
          }
        }
      }
      //======placeOfBirth
      if (
        item.individual_place_of_birth &&
        item.individual_place_of_birth !== ''
      ) {
        const places = item.individual_place_of_birth;
        if (places instanceof Array) {
          //others infos
          const cleanPlaces = places.map((elt) => {
            let placeComment = `${elt.country}`;
            if (elt.city) placeComment = `${placeComment} - ${elt.city}`;
            if (elt.state_province)
              placeComment = `${placeComment} - ${elt.state_province}`;
            if (elt.note) placeComment = `${placeComment} - ${elt.note}`;
            return {
              comment: placeComment,
              value: getAlpha2Code(elt.country, 'en'),
              type: 'OtherPlaceOfBirth',
            };
          });
          othersInfos = othersInfos.concat(cleanPlaces);
          //==== set place of birth
          const place = {
            country: {
              name: places[0].country,
              isoCode: getAlpha2Code(places[0].country, 'en'),
            },
          };
          if (places[0].note) place['place'] = places[0].note;
          if (places[0].state_province)
            place['stateOrProvince'] = places[0].state_province;
          if (places[0].city) place['place'] = places[0].city;

          entity['placeOfBirth'] = place;
        } else {
          const place = {
            country: {
              name: places.country,
              isoCode: getAlpha2Code(places.country, 'en'),
            },
          };
          if (places.note) place['place'] = places.note;
          if (places.state_province)
            place['stateOrProvince'] = places.state_province;
          if (places.city) place['place'] = places.city;

          entity['placeOfBirth'] = place;
        }
      }
      //==== title
      if (item.designation && item.designation !== '') {
        const titles = item.designation.value;
        if (titles instanceof Array) {
          //others infos
          const cleantitles = [];
          titles.forEach((elt) => {
            cleantitles.push({ value: elt, type: 'otherTitle' });
          });
          othersInfos = othersInfos.concat(cleantitles);
          // set title
          entity['title'] = titles[0];
        } else {
          entity['title'] = titles;
        }
      }
      if (item.title && item.title !== '') {
        const titles = item.title.value;
        if (titles instanceof Array) {
          //others infos
          const cleantitles = [];
          titles.forEach((elt) => {
            cleantitles.push({ value: elt, type: 'otherTitle' });
          });
          othersInfos = othersInfos.concat(cleantitles);
        } else {
          othersInfos.push({ value: titles, type: 'otherTitle' });
        }
      }
      //==== programs
      const programs = [];
      if (item.un_list_type && item.un_list_type !== '')
        programs.push(item.un_list_type);
      if (item.reference_number && item.reference_number !== '')
        programs.push(item.reference_number);
      entity['programs'] = programs;
      //==== references
      const references = [];
      if (item.comments1 !== '' && item.comments1) {
        references.push(item.comments1);
      }
      entity['references'] = references;
      //==== addresses
      if (item.individual_address && item.individual_address !== '') {
        const places = item.individual_address;
        if (places instanceof Array) {
          const cleanPlaces = places.map((elt) => {
            const address = {};
            if (elt.note && elt.note !== '') address['place'] = elt.note;
            if (elt.city && elt.city !== '') address['place'] = elt.city;
            if (elt.street && elt.street !== '')
              address['place'] = `${address['place']}  ${elt.street}`.trim();
            if (elt.state_province && elt.state_province !== '')
              address['stateOrProvince'] = elt.state_province;
            if (elt.country && elt.country !== '')
              address['country'] = {
                isoCode: getAlpha2Code(elt.country, 'en'),
                name: elt.country,
              };
            return address;
          });
          entity['addresses'] = cleanPlaces;
        } else {
          const address = {};
          if (places.city && places.city !== '') address['place'] = places.city;
          if (places.street && places.street !== '')
            address['place'] = `${address['place']}  ${places.street}`.trim();
          if (places.state_province && places.state_province !== '')
            address['stateOrProvince'] = places.state_province;
          if (places.country && places.country !== '')
            address['country'] = {
              isoCode: getAlpha2Code(places.country, 'en'),
              name: places.country,
            };
          if (
            address['place'] ||
            address['stateOrProvince'] ||
            address['country']
          )
            entity.addresses = [address];
        }
      }
      //nationalities
      if (item.nationality) {
        const nationalities = item.nationality.value;
        const cleanPlaces = [];
        if (nationalities instanceof Array) {
          nationalities.forEach((elt) => {
            if (elt !== '') {
              const data = { country: elt };
              const iso = getAlpha2Code(elt, 'en');
              if (iso) data['isoCode'] = iso;
              cleanPlaces.push(data);
            }
          });
        } else {
          if (nationalities !== '') {
            const data = { country: nationalities };
            const iso = getAlpha2Code(nationalities, 'en');
            if (iso) data['isoCode'] = iso;
            cleanPlaces.push(data);
          }
        }
        entity['nationalities'] = cleanPlaces;
      }
      //othersInfos
      if (item.individual_document && item.individual_document !== '') {
        const infos = item.individual_document;
        if (infos instanceof Array) {
          infos.forEach((elt) => {
            const data = {};
            let comments = '';
            if (elt.type_of_document && elt.type_of_document !== '')
              data['type'] = elt.type_of_document;
            if (elt.number && elt.number !== '') data['value'] = elt.number;
            if (elt.country_of_issue && elt.country_of_issue !== '')
              comments = `${comments}  ${elt.country_of_issue}`;
            if (elt.issuing_country && elt.issuing_country !== '')
              comments = `${comments}  ${elt.issuing_country}`;
            if (elt.note && elt.note !== '')
              comments = `${comments}  ${elt.note}`;
            if (elt.type_of_document2 && elt.type_of_document2 !== '')
              comments = `${comments}  ${elt.type_of_document2}`;

            data['comment'] = comments.trim();

            othersInfos.push(data);
          });
        } else {
          const data = {};
          let comments = '';
          if (infos.type_of_document && infos.type_of_document !== '')
            data['type'] = infos.type_of_document;
          if (infos.number && infos.number !== '') data['value'] = infos.number;
          if (infos.country_of_issue && infos.country_of_issue !== '')
            comments = `${comments}  ${infos.country_of_issue}`;
          if (infos.issuing_country && infos.issuing_country !== '')
            comments = `${comments}  ${infos.issuing_country}`;
          if (infos.note && infos.note !== '')
            comments = `${comments}  ${infos.note}`;
          if (infos.type_of_document2 && infos.type_of_document2 !== '')
            comments = `${comments}  ${infos.type_of_document2}`;

          data['comment'] = comments.trim();

          othersInfos.push(data);
        }
      }
      entity['othersInfos'] = othersInfos;
      return entity;
    });

    //=====---- Map Entities ----=========
    const entities = sources2.entity;
    const cleanEntities = entities.map((item) => {
      const entity = {
        id: this.transformId(item.dataid),
        type: 'Entity',
        listId: list[0].id,
        defaultName: item.first_name,
        othersInfos: [],
        references: [],
        addresses: [],
      };
      //====akas
      const akas = [];
      if (item.entity_alias) {
        if (item.entity_alias instanceof Array) {
          item.entity_alias.forEach((aka) => {
            if (aka.alias_name !== '') akas.push(aka.alias_name);
          });
        } else {
          if (item.entity_alias.alias_name !== '')
            akas.push(item.entity_alias.alias_name);
        }
      }
      if (item.name_original_script) akas.push(item.name_original_script);
      entity['akas'] = akas;
      //====remarks
      if (item.comments1 && item.comments1 !== '')
        entity['remarks'] = item.comments1;
      //programs
      const programs = [];
      if (item.un_list_type && item.un_list_type !== '')
        programs.push(item.un_list_type);
      if (item.reference_number && item.reference_number !== '')
        programs.push(item.reference_number);
      entity['programs'] = programs;
      //references
      const references = [];
      if (item.comments1 !== '' && item.comments1) {
        references.push(item.comments1);
      }
      entity['references'] = references;
      //addresses
      if (item.entity_address && item.entity_address !== '') {
        const places = item.entity_address;
        if (places instanceof Array) {
          const cleanPlaces = places.map((elt) => {
            const address = {};
            if (elt.note && elt.note !== '') address['place'] = elt.note;
            if (elt.city && elt.city !== '') address['place'] = elt.city;
            if (elt.street && elt.street !== '')
              address['place'] = `${address['place']}  ${elt.street}`.trim();
            if (elt.state_province && elt.state_province !== '')
              address['stateOrProvince'] = elt.state_province;
            if (elt.country && elt.country !== '')
              address['country'] = {
                isoCode: getAlpha2Code(elt.country, 'en'),
                name: elt.country,
              };
            return address;
          });
          entity['addresses'] = cleanPlaces;
        } else {
          const address = {};
          if (places.note && places.note !== '') address['place'] = places.note;
          if (places.city && places.city !== '') address['place'] = places.city;
          if (places.street && places.street !== '')
            address['place'] = `${address['place']}  ${places.street}`.trim();
          if (places.state_province && places.state_province !== '')
            address['stateOrProvince'] = places.state_province;
          if (places.country && places.country !== '')
            address['country'] = {
              isoCode: getAlpha2Code(places.country, 'en'),
              name: places.country,
            };
          if (
            address['place'] ||
            address['stateOrProvince'] ||
            address['country']
          )
            entity.addresses = [address];
        }
      }
      return entity;
    });

    const cleanData = cleanEntities.concat(cleanIndividual);
    const finalData = {
      lists: list,
      results: cleanData,
      total: cleanData.length,
    };
    if (finalData.lists && finalData.results)
      this.logger.log('(success !) all is well');

    const sourceLinkFile = `${SOURCE_DIR}clean_UN.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(finalData));
    writeStream.end();
  }
  //UK Financial sanctions targets
  async getSanctionUk() {
    this.logger.log('====== Getting Sanction From UK Source...');
    const url = this.config.get('TEST_SOURCE');
    //request
    await this.saveJsonFromXml(url, 'liste_UK');
  }

  async mapSanctionUk() {
    const data = await this.downloadData('liste_UK.json');
    return data;
  }
  //Office of Financial Sanctions Implementation HM Treasury

  //Liste consolidée de sanctions financières de l’UE
  async getSanctionUe() {
    this.logger.log('====== Getting Sanction From UE Source...');
    const url = this.config.get('UE_SOURCE');
    //request
    await this.saveJsonFromXml(url, 'liste_UE');
  }

  async mapSanctionUe() {
    this.logger.log('====== Mapping Cleaning & Saving data From DGT Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataUe = await this.downloadData('liste_UE.json');

    const list = [
      {
        id: this.transformId(12),
        name: 'EU financial sanctions (EUFS) - Persons, Groups and Entities subject to EU financial sanctions',
        sourceUrl:
          'https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions?locale=en',
        importRate: 'Hourly',
        lastImported: dataUe.export.value.generationDate,
        publicationDate: dataUe.export.value.generationDate,
      },
    ];
    const sources: any = dataUe.export.sanctionentity;
    const cleanSource = sources.map((item) => {
      const entity = {
        listId: list[0].id,
      };
      const othersInfos = [];

      // ==== names & akas & gender & title
      if (item.namealias) {
        const names = item.namealias;
        const alias = [];
        if (names instanceof Array) {
          //----names
          if (names[0].value.firstName !== '')
            entity['firstName'] = names[0].value.firstName;
          if (names[0].value.middleName !== '')
            entity['middleName'] = names[0].value.middleName;
          if (names[0].value.lastName !== '')
            entity['lastName'] = names[0].value.lastName;
          if (names[0].value.defaultName !== '')
            entity['defaultName'] = names[0].value.wholeName;
          //----gender
          if (names[0].value.gender && names[0].value.gender !== '') {
            if (names[0].value.gender == 'M') entity['gender'] = 'Male';
            if (names[0].value.gender == 'F') entity['gender'] = 'Female';
          }
          //----title
          let title = '';
          if (names[0].value.title !== '') title = names[0].value.title;
          if (names[0].value.function && names[0].value.function !== '')
            title = `${title} ${names[0].value.function}`;

          if (title !== '') entity['title'] = title;
          //----akas
          names.forEach((elt, i) => {
            if (i !== 0) {
              alias.push(elt.value.wholeName);

              let title = '';
              if (elt.value.title !== '') title = elt.value.title;

              if (elt.value.function && elt.value.function !== '')
                title = `${title} ${elt.value.function}`;
              if (title !== '')
                othersInfos.push({
                  value: title,
                  type: 'otherTitle',
                });
            }
          });
          entity['akas'] = alias;
        } else {
          //----names
          if (names.value.firstName !== '')
            entity['firstName'] = names.value.firstName;
          if (names.value.middleName !== '')
            entity['middleName'] = names.value.middleName;
          if (names.value.lastName !== '')
            entity['lastName'] = names.value.lastName;
          if (names.value.defaultName !== '')
            entity['defaultName'] = names.value.wholeName;
          //----gender
          if (names.value.gender && names.value.gender !== '') {
            if (names.value.gender == 'M') entity['gender'] = 'Male';
            if (names.value.gender == 'F') entity['gender'] = 'Female';
          }
        }
      }

      //==== type
      if (item.subjecttype) {
        const types = item.subjecttype;
        if (types.value.classificationCode == 'P')
          entity['type'] = 'Individual';
        if (types.value.classificationCode == 'E') entity['type'] = 'Entity';
      }

      //==== remarks
      if (item.remark && item.remark !== '') {
        if (item.remark instanceof Array) {
          let remark = '';
          item.remark.forEach((elt) => {
            remark = `${remark} ${elt}`;
            entity['remarks'] = remark.trim;
          });
        } else {
          entity['remarks'] = item.remark;
        }
      }

      //==== dateOfBirth & placeOfBirth
      if (item.birthdate) {
        const birth = item.birthdate;
        const date = {};
        const place = {};
        if (birth instanceof Array) {
          birth.forEach((elt, i) => {
            if (i == 0) {
              //---dateOfBirth
              if (elt.value.dayOfMonth && elt.value.dayOfMonth !== '')
                date['day'] = elt.value.dayOfMonth;
              if (elt.value.monthOfYear && elt.value.monthOfYear !== '')
                date['month'] = elt.value.monthOfYear;
              if (elt.value.year && elt.value.year !== '')
                date['year'] = elt.value.year;
              entity['dateOfBirth'] = date;
              //---placeOfBirth
              if (
                elt.value.countryIso2Code &&
                elt.value.countryIso2Code !== ''
              ) {
                const country = {};
                country['isoCode'] = elt.value.countryIso2Code;
                country['name'] = elt.value.countryDescription;
                place['country'] = country;
              }
              if (elt.value.city && elt.value.city !== '') {
                place['place'] = elt.value.city;
              }
              if (elt.value.zipCode && elt.value.zipCode !== '') {
                place['postalCode'] = elt.value.zipCode;
              }
              if (elt.value.region && elt.value.region !== '') {
                place['stateOrProvince'] = elt.value.region;
              }
              entity['placeOfBirth'] = place;
            } else {
              if (elt.value.birthdate)
                othersInfos.push({
                  value: elt.value.birthdate,
                  type: 'OtherBirthDate',
                });
              if (elt.value.year)
                othersInfos.push({
                  value: elt.value.year,
                  type: 'OtherBirthDate',
                });

              if (
                elt.value.countryIso2Code &&
                elt.value.countryIso2Code !== ''
              ) {
                let comment = '';
                if (elt.value.zipCode && elt.value.zipCode !== '')
                  comment = `${comment} ${elt.value.zipCode}`;

                if (elt.value.city && elt.value.city !== '')
                  comment = `${comment} ${elt.value.city}`;

                if (elt.value.region && elt.value.region !== '')
                  comment = `${comment} ${elt.value.region}`;

                othersInfos.push({
                  comment: comment.trim(),
                  value: elt.value.countryIso2Code,
                  type: 'OtherPlaceOfBirth',
                });
              }
            }
          });
        } else {
          //---dateOfBirth
          if (birth.value.dayOfMonth && birth.value.dayOfMonth !== '')
            date['day'] = birth.value.dayOfMonth;
          if (birth.value.monthOfYear && birth.value.monthOfYear !== '')
            date['month'] = birth.value.monthOfYear;
          if (birth.value.year && birth.value.year !== '')
            date['year'] = birth.value.year;
          entity['dateOfBirth'] = date;
          //---placeOfBirth
          if (
            birth.value.countryIso2Code &&
            birth.value.countryIso2Code !== ''
          ) {
            const country = {};
            country['isoCode'] = birth.value.countryIso2Code;
            country['name'] = birth.value.countryDescription;
            place['country'] = country;
          }
          if (birth.value.city && birth.value.city !== '') {
            place['place'] = birth.value.city;
          }
          if (birth.value.zipCode && birth.value.zipCode !== '') {
            place['postalCode'] = birth.value.zipCode;
          }
          if (birth.value.region && birth.value.region !== '') {
            place['stateOrProvince'] = birth.value.region;
          }
          entity['placeOfBirth'] = place;
        }
      }

      //==== programs
      if (item.regulation) {
        let programs = '';
        if (item.regulation.value.programme)
          programs = `${programs} ${item.regulation.value.programme}`;
        if (item.regulation.value.regulationType)
          programs = `${programs} ${item.regulation.value.regulationType}`;
        if (item.regulation.value.organisationType)
          programs = `${programs} ${item.regulation.value.organisationType}`;

        entity['programs'] = [programs.trim()];

        if (item.regulation.publicationurl)
          entity['publicationUrl'] = item.regulation.publicationurl;
      }

      //==== references
      let reference = '';
      if (item.value.euReferenceNumber)
        reference = `${reference} ${item.value.euReferenceNumber}`;
      if (item.value.designationDate)
        reference = `${reference} - ${item.value.designationDate}`;
      entity['references'] = [reference.trim()];

      //==== addresses
      if (item.address) {
        const addresses = item.address;
        if (addresses instanceof Array) {
          entity['addresses'] = addresses.map((elt) => {
            const data = {};
            let place = '';
            if (elt.value.city && elt.value.city !== '')
              place = `${place} ${elt.value.city}`;
            if (elt.value.street && elt.value.street !== '')
              place = `${place} ${elt.value.street}`;
            if (place !== '') data['place'] = place;

            if (elt.value.poBox && elt.value.poBox !== '')
              data['postalCode'] = elt.value.poBox;

            if (elt.value.region && elt.value.region !== '')
              data['stateOrProvince'] = elt.value.region;

            if (elt.value.countryIso2Code && elt.value.countryIso2Code !== '')
              data['country'] = {
                isoCode: elt.value.countryIso2Code,
                name: getName(elt.value.countryIso2Code, 'en'),
              };
            return data;
          });
        } else {
          const data = {};
          let place = '';
          if (addresses.value.city && addresses.value.city !== '')
            place = `${place} ${addresses.value.city}`;
          if (addresses.value.street && addresses.value.street !== '')
            place = `${place} ${addresses.value.street}`;
          if (place !== '') data['place'] = place;

          if (addresses.value.poBox && addresses.value.poBox !== '')
            data['postalCode'] = addresses.value.poBox;

          if (addresses.value.region && addresses.value.region !== '')
            data['stateOrProvince'] = addresses.value.region;

          if (
            addresses.value.countryIso2Code &&
            addresses.value.countryIso2Code !== ''
          )
            data['country'] = {
              isoCode: addresses.value.countryIso2Code,
              name: getName(addresses.value.countryIso2Code, 'en'),
            };
          entity['addresses'] = [data];
        }
      }

      //==== citizenships
      if (item.citizenship) {
        const citizenship = item.citizenship;
        if (citizenship instanceof Array) {
          entity['citizenships'] = citizenship.map((elt) => {
            const data = {};
            if (elt.value.countryIso2Code && elt.value.countryIso2Code !== '') {
              if (elt.value.countryIso2Code != '00') {
                data['isoCode'] = elt.value.countryIso2Code;
                data['country'] = getName(elt.value.countryIso2Code, 'en');
              } else {
                data['isoCode'] = elt.value.countryIso2Code;
                data['country'] = elt.value.countryDescription;
              }
            }
            //----othersInfos
            if (elt.value.contactinfo && elt.value.contactinfo !== '') {
              const info = { type: '', value: '' };
              if (elt.value.contactinfo.value.key !== '')
                info['type'] = elt.value.contactinfo.value.key;
              if (elt.value.contactinfo.value.key !== '')
                info['value'] = elt.value.contactinfo.value.value;

              if (info.type !== '' && info.value !== '') othersInfos.push(info);
            }
            return data;
          });
        } else {
          const data = {};
          if (
            citizenship.value.countryIso2Code &&
            citizenship.value.countryIso2Code !== ''
          ) {
            if (citizenship.value.countryIso2Code != '00') {
              data['isoCode'] = citizenship.value.countryIso2Code;
              data['country'] = getName(
                citizenship.value.countryIso2Code,
                'en',
              );
            } else {
              data['isoCode'] = citizenship.value.countryIso2Code;
              data['country'] = citizenship.value.countryDescription;
            }
            entity['citizenships'] = [data];
          }
          //----othersInfos
          if (
            citizenship.value.contactinfo &&
            citizenship.value.contactinfo !== ''
          ) {
            const info = { type: '', value: '' };
            if (citizenship.value.contactinfo.value.key !== '')
              info['type'] = citizenship.value.contactinfo.value.key;
            if (citizenship.value.contactinfo.value.key !== '')
              info['value'] = citizenship.value.contactinfo.value.value;

            if (info.type !== '' && info.value !== '') othersInfos.push(info);
          }
        }
      }

      entity['othersInfos'] = othersInfos;
      return entity;
    });

    const finalData = {
      lists: list,
      results: cleanSource,
      total: cleanSource.length,
    };

    if (finalData.lists && finalData.results)
      this.logger.log('(success !) all is well');

    const sourceLinkFile = `${SOURCE_DIR}clean_UE.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(finalData));
    writeStream.end();
  }

  async getPepList(): Promise<any> {
    this.logger.log('====== Reading PoliticallyExposedPerson Saved File...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const fileName = 'nested_PEP';

    const stream = createReadStream(`${SOURCE_DIR}${fileName}.json`, {
      encoding: 'utf8',
    });
    const reader = createInterface({ input: stream, crlfDelay: Infinity });

    const dataArray = [];

    for await (const line of reader) {
      const obj = JSON.parse(line);

      // if (obj.schema !== 'Person' && obj.schema !== 'Organization') {
      //   console.log(obj);
      // }

      // if (obj.schema !== 'Organization' && obj.schema !== 'Company') {
      //   console.log(obj);
      // }

      let alias = [];
      let othersInfos = [];
      let relations = [];

      const entity = {
        defaultName: obj.caption,
        type: obj.schema,
      };

      if (obj.properties) {
        const prop = obj.properties;
        //firstName
        if (prop.firstName) entity['firstName'] = prop.firstName[0];
        //lastName
        if (prop.lastName) entity['lastName'] = prop.lastName[0];
        //alias
        if (prop.alias) alias = prop.alias;
        if (prop.name && prop.name.length > 1) {
          const [, ...names] = prop.name;
          alias.concat(names);
          entity['alias'] = alias;
        }
        //gender
        if (prop.gender) entity['gender'] = prop.gender[0];
        //position
        if (prop.status) entity['positions'] = prop.status;
        //position
        if (prop.position) entity['positions'] = prop.position;
        //notes
        if (prop.notes) entity['notes'] = prop.notes;
        //dateOfBirth
        if (prop.birthDate) {
          entity['dateOfBirth'] = this.transformDate(prop.birthDate[0]);
        }
        //placeOfBirth
        if (prop.birthPlace) entity['placeOfBirth'] = prop.birthPlace;
        //website
        if (prop.website) entity['website'] = prop.website[0];
        //publicationUrl
        if (prop.sourceUrl) entity['publicationUrl'] = prop.sourceUrl[0];
        //addresses
        if (prop.addressEntity) {
          const addresses = prop.addressEntity;
          entity['addresses'] = addresses.map((address) => {
            const place = {
              place: address.caption,
            };
            if (address.properties.city)
              place['stateOrProvince'] = address.properties.city[0];
            if (address.properties.country) {
              const isoCode = address.properties.country[0];
              place['country'] = {
                isoCode: isoCode,
                name: getName(isoCode, 'en'),
              };
            }
            return place;
          });
        }
        //citizenships
        if (prop.country) {
          let countries = [];
          prop.country.forEach((country) => {
            const place = {
              isoCode: country,
              name: getName(country, 'en'),
            };
            countries.push(place);
          });
          const filtered = countries.filter(
            (country) => country.isoCode.length == 2 || country.name,
          );
          if (filtered.length > 0) entity['citizenships'] = filtered;
        }
        //nationalities
        if (prop.nationality) {
          let countries = [];
          prop.nationality.forEach((country) => {
            const place = {
              isoCode: country,
              name: getName(country, 'en'),
            };
            countries.push(place);
          });
          const filtered = countries.filter(
            (country) => country.isoCode.length == 2 || country.name,
          );
          if (filtered.length > 0) entity['nationalities'] = filtered;
        }
        //othersInfos
        if (prop.modifiedAt) {
          othersInfos.push({
            type: 'modifiedAt',
            value: prop.modifiedAt[0],
          });
        }
        if (prop.title) {
          othersInfos.push({
            type: 'title',
            value: prop.title,
          });
        }
        if (prop.keywords) {
          othersInfos.push({
            type: 'keywords',
            value: prop.keywords,
          });
        }
        if (prop.incorporationDate) {
          othersInfos.push({
            type: 'incorporationDate',
            value: prop.incorporationDate,
          });
        }
        if (prop.summary) {
          othersInfos.push({
            type: 'summary',
            value: prop.summary,
          });
        }
        if (prop.sector) {
          othersInfos.push({
            type: 'sector',
            value: prop.sector,
          });
        }
        if (prop.website) {
          othersInfos.push({
            type: 'website',
            value: prop.website,
          });
        }
        if (prop.email) {
          othersInfos.push({
            type: 'email',
            value: prop.email,
          });
        }
        if (prop.phone) {
          othersInfos.push({
            type: 'phone',
            value: prop.phone,
          });
        }

        if (othersInfos.length > 0) entity['othersInfos'] = othersInfos;
        //relations
        if (prop.unknownLinkTo) {
          const links = prop.unknownLinkTo;
          const cleanLinks = links.map((elt) => {
            const eltProps = elt.properties;
            let summary = [];
            let names = [];
            const link = {
              nature: 'Unknown Link',
              defaultName: eltProps.object[0].caption,
              type: eltProps.object[0].schema,
            };
            if (eltProps.object[0].properties) {
              const linkProp = eltProps.object[0].properties;
              if (linkProp.alias) names = [...linkProp.alias, ...names];
              if (linkProp.name)
                names = [...new Set([...linkProp.name, ...names])];
              if (names.length > 0) link['alias'] = names;
              if (linkProp.gender) link['gender'] = linkProp.gender;
              if (linkProp.position) link['positions'] = linkProp.position;
              if (linkProp.notes) summary = [...summary, ...linkProp.notes];
              if (linkProp.summary)
                summary = [...new Set([...summary, ...linkProp.summary])];
              if (summary.length > 0) link['notes'] = summary;
              if (linkProp.incorporationDate)
                link['incorporationDate'] = this.transformDate(
                  linkProp.incorporationDate,
                );
              if (linkProp.country) {
                let countries = [];
                linkProp.country.forEach((country) => {
                  const place = {
                    isoCode: country,
                    name: getName(country, 'en'),
                  };
                  countries.push(place);
                });
                const filtered = countries.filter((country) => country.name);
                if (filtered.length > 0) link['citizenships'] = filtered;
              }
            }
            return link;
          });
          relations = relations.concat(cleanLinks);

          entity['relations'] = relations;
          //createdAt

          //console.log(prop.unknownLinkTo[0].properties.object[0].properties);
          //console.log(prop);
        }
        if (prop.associations) {
          const links = prop.associations;
          const cleanLinks = links.map((elt) => {
            const eltProps = elt.properties.person[0];
            let names = [];
            const link = {
              nature: 'Associate',
              defaultName: eltProps.caption,
              type: eltProps.schema,
            };
            if (eltProps.properties) {
              const linkProp = eltProps.properties;
              if (linkProp.alias) names = [...linkProp.alias, ...names];
              if (linkProp.name)
                names = [...new Set([...linkProp.name, ...names])];
              if (linkProp.gender) link['gender'] = linkProp.gender[0];
              
              if (linkProp.position) link['positions'] = linkProp.position;
              if (linkProp.notes) link['notes'] = linkProp.notes;
              if (linkProp.birthDate)
                link['dateOfBirth'] = this.transformDate(linkProp.birthDate[0]);
              if (linkProp.birthPlace) link['placeOfBirth'] ={ place: linkProp.birthPlace[0]};
              if (linkProp.country) {
                let countries = [];
                linkProp.country.forEach((country) => {
                  const place = {
                    isoCode: country,
                    name: getName(country, 'en'),
                  };
                  countries.push(place);
                });
                const filtered = countries.filter((country) => country.name);
                if (filtered.length > 0) link['citizenships'] = filtered;
              }
              if (linkProp.nationality) {
                let countries = [];
                linkProp.nationality.forEach((country) => {
                  const place = {
                    isoCode: country,
                    name: getName(country, 'en'),
                  };
                  countries.push(place);
                });
                const filtered = countries.filter((country) => country.name);
                if (filtered.length > 0) link['nationalities'] = filtered;
              }
            }
            return link;
          });
          relations = relations.concat(cleanLinks);

          entity['relations'] = relations;
          //createdAt

          //console.log(prop.unknownLinkTo[0].properties.object[0].properties);
          console.log(prop);
        }
        if (prop.first_seen) entity['createdAt'] = prop.first_seen;
        //updatedAt
        if (prop.last_seen) entity['updatedAt'] = prop.last_seen;
      }
      dataArray.push(entity);
    }

    //console.log(dataArray.filter((elt) => elt.addresses));
  }

  async mapPep() {
    this.logger.log('====== Mapping Cleaning & Saving data From PEP Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const data = await this.downloadData('liste_PEP.json');

    return data.slice(0, 100);
  }

  //Liste consolidée de sanctions financières de l’UE
  // async getSanctionPep() {
  //   const data = await this.downloadData('liste_PEP.json');
  //   return data;
  // }

  async getLists(fileName: string) {
    const { lists } = await this.downloadData(fileName);
    return lists;
  }
  //==== ---- map and save sanction into file ---- ====
  async mapSanction() {
    this.logger.log('====== Mapping Cleaning & Saving data From ITA Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    //---- list file
    let lists = [];
    //---- ITA
    const listIta = await this.getLists('clean_ITA.json');
    lists = lists.concat(listIta);

    //---- DGT
    const listDgt = await this.getLists('clean_DGT.json');
    lists = lists.concat(listDgt);

    //---- UN
    const listUn = await this.getLists('clean_UN.json');
    lists = lists.concat(listUn);

    //---- UE
    const listUE = await this.getLists('clean_UE.json');
    lists = lists.concat(listUE);

    const sourceLinkFile = `${SOURCE_DIR}clean_list.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(lists));
    writeStream.end();
  }

  transformDate(date: string): { day?: string; month?: string; year?: string } {
    const reg = /[-/\\]/;
    if (date.includes('\\z') || date.includes('/') || date.includes('-')) {
      const arrayDate = date.split(reg);
      if (arrayDate.length < 3) {
        if (arrayDate[0].length > 3) {
          return {
            month: arrayDate[1],
            year: arrayDate[0],
          };
        } else {
          return {
            month: arrayDate[0],
            year: arrayDate[1],
          };
        }
      } else {
        if (arrayDate[0].length > 3) {
          return {
            day: arrayDate[2],
            month: arrayDate[1],
            year: arrayDate[0],
          };
        } else {
          return {
            day: arrayDate[0],
            month: arrayDate[1],
            year: arrayDate[2],
          };
        }
      }
    }
    return { year: date };
  }
}
