/* eslint-disable @typescript-eslint/no-var-requires */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
const mysql = require('mysql2/promise');
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import { MigrationHelper } from './migration.helper';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private helper: MigrationHelper,
  ) {}

  // //=========Main method for all Migrations================
  // async migrateAllToMongo() {
  //   const result = await Promise.all([
  //     await this.migrateSantionToMongo(),
  //     await this.migrateSantionedToMongo(),
  //     this.migrateNationalityListToMongo(),
  //     this.migrateCitizenshipListToMongo(),
  //     this.migrateDateOfBirthListToMongo(),
  //     this.migratePlaceOfBirthListToMongo(),
  //     this.migrateAkaListToMongo(),
  //   ]);

  //   this.logger.log('All is well !');
  //   return result;
  // }

  // //=========Main method for all Updates================
  // async updateAllToMongo() {
  //   const result = await Promise.all([
  //     await this.updateSantionToMongo(),
  //     await this.updateSantionedToMongo(),
  //     this.updateNationalityListToMongo(),
  //     this.updateCitizenshipListToMongo(),
  //     this.updateDateOfBirthListToMongo(),
  //     this.updatePlaceOfBirthListToMongo(),
  //     this.updateAkaListToMongo(),
  //   ]);

  //   this.logger.log('All is well !');
  //   return result;
  // }

  // //==== Method for sanctionList migration =========================
  // //------ Make migration --------
  // async migrateSantionToMongo() {
  //   this.logger.log('migrating sanctionList to MongoDB...');
  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = 'SELECT * FROM sanction_lists';
  //   const [table] = await connection.execute(querie);
  //   connection.close();

  //   //cleanup data
  //   const cleanData = table.map((elt) => {
  //     return {
  //       id: this.transformId(elt.id),
  //       name: elt.name,
  //       publicationDate: elt.publication_date,
  //       file: elt.file,
  //       numberOfLine: elt.number_of_line,
  //       updatedAt: elt.updated_at,
  //       createdAt: elt.created_at,
  //     };
  //   });
  //   //insert one element to apply MongoDB collection
  //   const { id, ...newData } = cleanData[0];
  //   await this.prisma.sanctionList.create({
  //     data: newData,
  //   });

  //   //delete all elements in collection
  //   const client = this.getMongoClient();
  //   await this.mongoDeleteMany('SanctionList', client).finally(() =>
  //     client.close(),
  //   );

  //   //migrate all to MongoDB
  //   let data: any[];
  //   let result;
  //   let count = 0;
  //   if (cleanData.length <= 5000) {
  //     result = await this.prisma.sanctionList.createMany({
  //       data: cleanData,
  //     });
  //     count += result.count;
  //   } else {
  //     for (let i = 0; i <= cleanData.length; i += 1000) {
  //       if (i >= cleanData.length) i = cleanData.length;
  //       data = cleanData.slice(i, i + 1000);
  //       if (data.length > 0) {
  //         result = await this.prisma.sanctionList.createMany({
  //           data: data,
  //         });
  //       }
  //       count += result.count;
  //     }
  //   }

  //   this.logger.log({
  //     message: `${Number(count)} element(s) migrated`,
  //   });
  //   return { sanctionListCount: count };
  // }
  // //----- Update database -------
  // async updateSantionToMongo() {
  //   this.logger.log('Updating sanctionList Collection...');
  //   //Get the last updated element from mongoDB
  //   const result = await this.prisma.sanctionList.findFirst({
  //     orderBy: { updatedAt: 'desc' },
  //     select: { updatedAt: true },
  //   });
  //   const lastDate = this.transformDate(result.updatedAt);

  //   // //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = `SELECT * FROM sanction_lists WHERE updated_at > '${lastDate}'`;
  //   const [table] = await connection.execute(querie);

  //   //get MySql data count
  //   const querieCount = `SELECT count(*) as count FROM sanction_lists`;
  //   const [mysqlCount] = await connection.execute(querieCount);
  //   connection.close();
  //   this.logger.log(`${mysqlCount[0].count} sanctionLists element(s) in MySql`);
  //   //get MongoDB data count
  //   const mongoCount = await this.prisma.sanctionList.count();
  //   this.logger.log(`${mongoCount} sanctionLists element(s) in MongoDB`);

  //   if (table.length > 0 || mongoCount != mysqlCount[0].count) {
  //     this.logger.log({ message: 'Change detected in Mysql applying updates' });
  //     // Apply updates
  //     await this.migrateSantionToMongo();
  //     return {
  //       message: 'Change detected in Mysql applying updates (sanctionList)',
  //     };
  //   } else {
  //     this.logger.log({
  //       message: 'No change detected in Mysql (sanctionList)',
  //     });
  //     return { message: 'No change detected in Mysql (sanctionList)' };
  //   }
  // }

  // //===== Method for sanctioned migration ========================
  // //------ Make migration --------
  // async migrateSantionedToMongo() {
  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = 'SELECT * FROM sanctioned';
  //   const [table] = await connection.execute(querie);
  //   connection.close();

  //   //cleanup data
  //   const cleanData: any = table.map((elt) => {
  //     const otherNames = [];
  //     if (elt.name1 != null) otherNames.push(elt.name1);
  //     if (elt.name3 != null) otherNames.push(elt.name3);
  //     if (elt.name2 != null) otherNames.push(elt.name2);
  //     if (elt.name4 != null) otherNames.push(elt.name4);
  //     if (elt.name5 != null) otherNames.push(elt.name5);
  //     if (elt.name6 != null) otherNames.push(elt.name6);
  //     let defaultName = '';

  //     if (elt.firstname != null)
  //       defaultName = defaultName + ' ' + elt.firstname;
  //     if (elt.middlename != null)
  //       defaultName = defaultName + ' ' + elt.middlename;
  //     if (elt.lastname != null) defaultName = defaultName + ' ' + elt.lastname;

  //     if (elt.original_name != null) {
  //       defaultName = defaultName + ' ' + elt.original_name;
  //     } else {
  //       for (const name of otherNames) {
  //         defaultName = defaultName + ' ' + name;
  //       }
  //     }

  //     return {
  //       id: this.transformId(elt.id),
  //       listId: this.transformId(elt.list_id),
  //       firstName: elt.firstname,
  //       middleName: elt.middlename,
  //       lastName: elt.lastname,
  //       defaultName: defaultName.trim(),
  //       title: elt.title,
  //       type: elt.type,
  //       remark: elt.remark,
  //       gender: elt.gender,
  //       designation: elt.designation,
  //       motive: elt.motive,
  //       reference: elt.ref,
  //       referenceUe: elt.ref_ue,
  //       referenceOnu: elt.onu,
  //       unListType: elt.un_list_type,
  //       listedOn: elt.listed_on,
  //       listType: elt.list_type,
  //       submittedBy: elt.submitted_by,
  //       originalName: elt.original_name,
  //       otherNames: otherNames,
  //       updatedAt: elt.updated_at,
  //       createdAt: elt.created_at,
  //     };
  //   });

  //   this.logger.log('migrating sanctioned to MongoDB...');
  //   //insert one element to apply MongoDB collection
  //   const { id, ...newData } = cleanData[0];
  //   await this.prisma.sanctioned.create({
  //     data: newData,
  //   });

  //   //delete all elements in collection
  //   const client = this.getMongoClient();
  //   await this.mongoDeleteMany('Sanctioned', client).finally(() =>
  //     client.close(),
  //   );

  //   //migrate all to MongoDB
  //   //push data in data in batches of 1000 to avoid errors and timeouts
  //   let data: any[];
  //   let result;
  //   let count = 0;
  //   if (cleanData.length <= 5000) {
  //     result = await this.prisma.sanctioned.createMany({ data: cleanData });
  //     count += result.count;
  //   } else {
  //     for (let i = 0; i <= cleanData.length; i += 1000) {
  //       if (i >= cleanData.length) i = cleanData.length;
  //       data = cleanData.slice(i, i + 1000);
  //       if (data.length > 0) {
  //         result = await this.prisma.sanctioned.createMany({ data: data });
  //       }
  //       count += result.count;
  //     }
  //   }
  //   this.logger.log({
  //     message: `${Number(count)} element(s) migrated`,
  //   });
  //   return { SantionedCount: count };
  // }
  // //----- Update database -------
  // async updateSantionedToMongo() {
  //   this.logger.log('Updating sanctioned Collection...');
  //   //Get the last updated element from mongoDB
  //   const result = await this.prisma.sanctioned.findFirst({
  //     orderBy: { updatedAt: 'desc' },
  //     select: { updatedAt: true },
  //   });
  //   const lastDate = this.transformDate(result.updatedAt);

  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = `SELECT * FROM sanctioned WHERE updated_at > '${lastDate}'`;
  //   const [table] = await connection.execute(querie);

  //   //get MySql data count
  //   const querieCount = `SELECT count(*) as count FROM sanctioned`;
  //   const [mysqlCount] = await connection.execute(querieCount);
  //   connection.close();
  //   this.logger.log(`${mysqlCount[0].count} sanctioned element(s) in MySql`);
  //   //get MongoDB data count
  //   const mongoCount = await this.prisma.sanctioned.count();
  //   this.logger.log(`${mongoCount} sanctioned element(s) in MongoDB`);

  //   if (table.length > 0 || mongoCount != mysqlCount[0].count) {
  //     this.logger.log({
  //       message: 'Change detected in Mysql applying updates (sanctioned)',
  //     });
  //     // Apply updates
  //     await this.migrateSantionedToMongo();
  //     return {
  //       message: 'Change detected in Mysql applying updates (sanctioned)',
  //     };
  //   } else {
  //     this.logger.log({ message: 'No change detected in Mysql (sanctioned)' });
  //     return { message: 'No change detected in Mysql (sanctioned)' };
  //   }
  // }

  // //==== Method for NationalityList migration ==============
  // //------ Make migration --------
  // async migrateNationalityListToMongo() {
  //   this.logger.log('migrating nationalities to MongoDB...');
  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = 'SELECT * FROM nationality_lists';
  //   const [table] = await connection.execute(querie);
  //   connection.close();

  //   //cleanup data
  //   const cleanData = table.map((elt) => {
  //     let countryName = null;
  //     if (elt.country != null) countryName = this.toCapitalizeWord(elt.country);
  //     return {
  //       id: this.transformId(elt.id),
  //       sanctionedId: this.transformId(elt.sanctioned_id),
  //       country: countryName,
  //       code: elt.code,
  //       mainEntry: elt.main_entry,
  //       updatedAt: elt.updated_at,
  //       createdAt: elt.created_at,
  //     };
  //   });

  //   //insert one element to apply MongoDB collection
  //   const { id, ...newData } = cleanData[0];
  //   await this.prisma.nationalityList.create({
  //     data: newData,
  //   });

  //   //delete all elements in collection
  //   const client = this.getMongoClient();
  //   await this.mongoDeleteMany('NationalityList', client).finally(() =>
  //     client.close(),
  //   );

  //   //push data in data in batches of 1000 to avoid errors and timeouts
  //   let data: any[];
  //   let result;
  //   let count = 0;

  //   if (cleanData.length <= 5000) {
  //     result = await this.prisma.nationalityList.createMany({
  //       data: cleanData,
  //     });
  //     count += result.count;
  //   } else {
  //     for (let i = 0; i <= cleanData.length; i += 1000) {
  //       if (i >= cleanData.length) i = cleanData.length;
  //       data = cleanData.slice(i, i + 1000);
  //       if (data.length > 0) {
  //         result = await this.prisma.nationalityList.createMany({ data: data });
  //       }
  //       count += result.count;
  //     }
  //   }
  //   this.logger.log({
  //     message: `${Number(count)} element(s) migrated (Nationalities)`,
  //   });
  //   return { NationalityListCount: count };
  // }
  // //----- Update database -------
  // async updateNationalityListToMongo() {
  //   this.logger.log('Updating nationalities Collection...');
  //   //Get the last updated element from mongoDB
  //   const result = await this.prisma.nationalityList.findFirst({
  //     orderBy: { updatedAt: 'desc' },
  //     select: { updatedAt: true },
  //   });
  //   const lastDate = this.transformDate(result.updatedAt);

  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = `SELECT * FROM nationality_lists WHERE updated_at > '${lastDate}'`;
  //   const [table] = await connection.execute(querie);

  //   //get MySql data count
  //   const querieCount = `SELECT count(*) as count FROM nationality_lists`;
  //   const [mysqlCount] = await connection.execute(querieCount);
  //   connection.close();
  //   this.logger.log(`${mysqlCount[0].count} nationalities element(s) in MySql`);

  //   //get MongoDB data count
  //   const mongoCount = await this.prisma.nationalityList.count();
  //   this.logger.log(`${mongoCount} nationalities element(s) in MongoDB`);

  //   if (table.length > 0 || mongoCount != mysqlCount[0].count) {
  //     this.logger.log({
  //       message: 'Change detected in Mysql applying updates (nationalities)',
  //     });
  //     // Apply updates
  //     await this.migrateNationalityListToMongo();
  //     return {
  //       message: 'Change detected in Mysql applying updates (nationalities)',
  //     };
  //   } else {
  //     this.logger.log({
  //       message: 'No change detected in Mysql (nationalities)',
  //     });
  //     return { message: 'No change detected in Mysql (nationalities)' };
  //   }
  // }

  // //===== Method for CitizenshipList migration ===========
  // //------ Make migration --------
  // async migrateCitizenshipListToMongo() {
  //   this.logger.log('migrating Citizenships to MongoDB...');
  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = 'SELECT * FROM citizenship_lists';
  //   const [table] = await connection.execute(querie);
  //   connection.close();

  //   //cleanup data
  //   const cleanData = table.map((elt) => {
  //     let countryName = null;
  //     if (elt.country != null) countryName = this.toCapitalizeWord(elt.country);
  //     return {
  //       id: this.transformId(elt.id),
  //       sanctionedId: this.transformId(elt.sanctioned_id),
  //       country: countryName,
  //       code: elt.code,
  //       mainEntry: elt.main_entry,
  //       updatedAt: elt.updated_at,
  //       createdAt: elt.created_at,
  //     };
  //   });

  //   //insert one element to apply MongoDB collection
  //   const { id, ...newData } = cleanData[0];
  //   await this.prisma.citizenshipList.create({
  //     data: newData,
  //   });

  //   //delete all elements in collection
  //   const client = this.getMongoClient();
  //   await this.mongoDeleteMany('CitizenshipList', client).finally(() =>
  //     client.close(),
  //   );

  //   let data: any[];
  //   let result;
  //   let count = 0;

  //   if (cleanData <= 5000) {
  //     result = await this.prisma.citizenshipList.createMany({
  //       data: cleanData,
  //     });
  //     count += result.count;
  //   } else {
  //     for (let i = 0; i <= cleanData.length; i += 1000) {
  //       if (i >= cleanData.length) i = cleanData.length;
  //       data = cleanData.slice(i, i + 1000);
  //       if (data.length > 0) {
  //         result = await this.prisma.citizenshipList.createMany({ data: data });
  //       }
  //       count += result.count;
  //     }
  //     this.logger.log({
  //       message: `${Number(count)} element(s) migrated (Citizenships)`,
  //     });
  //     return { CitizenshipCount: count };
  //   }
  // }
  // //----- Update database -------
  // async updateCitizenshipListToMongo() {
  //   this.logger.log('Updating Citizenships Collection...');
  //   //Get the last updated element from mongoDB
  //   const result = await this.prisma.citizenshipList.findFirst({
  //     orderBy: { updatedAt: 'desc' },
  //     select: { updatedAt: true },
  //   });
  //   const lastDate = this.transformDate(result.updatedAt);

  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = `SELECT * FROM citizenship_lists WHERE updated_at > '${lastDate}'`;
  //   const [table] = await connection.execute(querie);

  //   //get MySql data count
  //   const querieCount = `SELECT count(*) as count FROM citizenship_lists`;
  //   const [mysqlCount] = await connection.execute(querieCount);
  //   connection.close();
  //   this.logger.log(`${mysqlCount[0].count} Citizenships element(s) in MySql`);

  //   //get MongoDB data count
  //   const mongoCount = await this.prisma.citizenshipList.count();
  //   this.logger.log(`${mongoCount} Citizenships element(s) in MongoDB`);

  //   if (table.length > 0 || mongoCount != mysqlCount[0].count) {
  //     this.logger.log({
  //       message: 'Change detected in Mysql applying updates (Citizenships)',
  //     });
  //     // Apply updates
  //     await this.migrateCitizenshipListToMongo();
  //     return {
  //       message: 'Change detected in Mysql applying updates (Citizenships)',
  //     };
  //   } else {
  //     this.logger.log({
  //       message: 'No change detected in Mysql (Citizenships)',
  //     });
  //     return { message: 'No change detected in Mysql (Citizenships)' };
  //   }
  // }

  // //====== Method for DateOfBirthList migration ==============
  // //------ Make migration --------
  // async migrateDateOfBirthListToMongo() {
  //   this.logger.log('migrating DatesOfBirth to MongoDB...');
  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = 'SELECT * FROM date_of_birth_lists';
  //   const [table] = await connection.execute(querie);
  //   connection.close();

  //   //cleanup data
  //   const cleanData = await table.map((elt) => {
  //     const date = this.formatDate(elt.date);

  //     return {
  //       id: this.transformId(elt.id),
  //       sanctionedId: this.transformId(elt.sanctioned_id),
  //       date: date,
  //       comment: elt.comment,
  //       mainEntry: elt.main_entry,
  //       updatedAt: elt.updated_at,
  //       createdAt: elt.created_at,
  //     };
  //   });

  //   //insert one element to apply MongoDB collection
  //   const { id, ...newData } = cleanData[0];
  //   await this.prisma.dateOfBirthList.create({
  //     data: newData,
  //   });

  //   //delete all elements in collection
  //   const client = this.getMongoClient();
  //   await this.mongoDeleteMany('DateOfBirthList', client).finally(() =>
  //     client.close(),
  //   );

  //   let data: any[];
  //   let result;
  //   let count = 0;
  //   if (cleanData.length <= 5000) {
  //     result = await this.prisma.dateOfBirthList.createMany({
  //       data: cleanData,
  //     });
  //     count += result.count;
  //   } else {
  //     for (let i = 0; i <= cleanData.length; i += 1000) {
  //       if (i >= cleanData.length) i = cleanData.length;
  //       data = cleanData.slice(i, i + 1000);
  //       if (data.length > 0) {
  //         result = await this.prisma.dateOfBirthList.createMany({ data: data });
  //       }
  //       count += result.count;
  //     }
  //   }

  //   this.logger.log({
  //     message: `${Number(count)} element(s) migrated (DatesOfBirth)`,
  //   });
  //   return { DateOfBirthCount: count };
  // }
  // //----- Update database -------
  // async updateDateOfBirthListToMongo() {
  //   this.logger.log('Updating DatesOfBirth Collection...');
  //   //Get the last updated element from mongoDB
  //   const result = await this.prisma.dateOfBirthList.findFirst({
  //     orderBy: { updatedAt: 'desc' },
  //     select: { updatedAt: true },
  //   });
  //   const lastDate = this.transformDate(result.updatedAt);

  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = `SELECT * FROM date_of_birth_lists WHERE updated_at > '${lastDate}'`;
  //   const [table] = await connection.execute(querie);

  //   //get MySql data count
  //   const querieCount = `SELECT count(*) as count FROM date_of_birth_lists`;
  //   const [mysqlCount] = await connection.execute(querieCount);
  //   connection.close();
  //   this.logger.log(`${mysqlCount[0].count} DatesOfBirth element(s) in MySql`);

  //   //get MongoDB data count
  //   const mongoCount = await this.prisma.dateOfBirthList.count();
  //   this.logger.log(`${mongoCount} DatesOfBirth element(s) in MongoDB`);

  //   if (table.length > 0 || mongoCount != mysqlCount[0].count) {
  //     this.logger.log({
  //       message: 'Change detected in Mysql applying updates (DatesOfBirth)',
  //     });
  //     // Apply updates
  //     await this.migrateDateOfBirthListToMongo();
  //     return {
  //       message: 'Change detected in Mysql applying updates (DatesOfBirth)',
  //     };
  //   } else {
  //     this.logger.log({
  //       message: 'No change detected in Mysql (DatesOfBirth)',
  //     });
  //     return { message: 'No change detected in Mysql (DatesOfBirth)' };
  //   }
  // }

  // //===== Method for PlaceOfBirthList migration ================
  // //------ Make migration --------
  // async migratePlaceOfBirthListToMongo() {
  //   this.logger.log('migrating PlacesOfBirth to MongoDB...');
  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = 'SELECT * FROM place_of_birth_lists';
  //   const [table] = await connection.execute(querie);
  //   connection.close();

  //   //cleanup data
  //   const cleanData = table.map((elt) => {
  //     return {
  //       id: this.transformId(elt.id),
  //       sanctionedId: this.transformId(elt.sanctioned_id),
  //       place: elt.place,
  //       city: elt.city,
  //       stateOrProvince: elt.state_or_province,
  //       postalCode: elt.postal_code,
  //       zipCode: elt.zip_code,
  //       country: elt.country,
  //       mainEntry: elt.main_entry,
  //       updatedAt: elt.updated_at,
  //       createdAt: elt.created_at,
  //     };
  //   });

  //   //insert one element to apply MongoDB collection
  //   const { id, ...newData } = cleanData[0];
  //   await this.prisma.placeOfBirthList.create({
  //     data: newData,
  //   });

  //   //delete all elements in collection
  //   const client = this.getMongoClient();
  //   await this.mongoDeleteMany('PlaceOfBirthList', client).finally(() =>
  //     client.close(),
  //   );

  //   let data: any[];
  //   let result;
  //   let count = 0;

  //   if (cleanData.length <= 5000) {
  //     result = await this.prisma.placeOfBirthList.createMany({
  //       data: cleanData,
  //     });
  //     count += result.count;
  //   } else {
  //     for (let i = 0; i <= cleanData.length; i += 1000) {
  //       if (i >= cleanData.length) i = cleanData.length;
  //       data = cleanData.slice(i, i + 1000);
  //       if (data.length > 0) {
  //         result = await this.prisma.placeOfBirthList.createMany({
  //           data: data,
  //         });
  //       }
  //       count += result.count;
  //     }
  //   }

  //   this.logger.log({
  //     message: `${Number(count)} element(s) migrated (PlacesOfBirth)`,
  //   });
  //   return { PlaceOfBirthCount: count };
  // }
  // //----- Update database -------
  // async updatePlaceOfBirthListToMongo() {
  //   this.logger.log('Updating PlacesOfBirth Collection...');
  //   //Get the last updated element from mongoDB
  //   const result = await this.prisma.placeOfBirthList.findFirst({
  //     orderBy: { updatedAt: 'desc' },
  //     select: { updatedAt: true },
  //   });
  //   const lastDate = this.transformDate(result.updatedAt);

  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = `SELECT * FROM place_of_birth_lists WHERE updated_at > '${lastDate}'`;
  //   const [table] = await connection.execute(querie);

  //   //get MySql data count
  //   const querieCount = `SELECT count(*) as count FROM place_of_birth_lists`;
  //   const [mysqlCount] = await connection.execute(querieCount);
  //   connection.close();
  //   this.logger.log(`${mysqlCount[0].count} PlacesOfBirth element(s) in MySql`);

  //   //get MongoDB data count
  //   const mongoCount = await this.prisma.placeOfBirthList.count();
  //   this.logger.log(`${mongoCount} PlacesOfBirth element(s) in MongoDB`);

  //   if (table.length > 0 || mongoCount != mysqlCount[0].count) {
  //     this.logger.log({
  //       message: 'Change detected in Mysql applying updates (PlacesOfBirth)',
  //     });
  //     // Apply updates
  //     await this.migratePlaceOfBirthListToMongo();
  //     return {
  //       message: 'Change detected in Mysql applying updates (PlacesOfBirth)',
  //     };
  //   } else {
  //     this.logger.log({
  //       message: 'No change detected in Mysql (PlacesOfBirth)',
  //     });
  //     return { message: 'No change detected in Mysql (PlacesOfBirth)' };
  //   }
  // }

  // ///=========== Akaslist =================
  // async migrateAkaListToMongo() {
  //   this.logger.log('migrating AkasList to MongoDB...');
  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = 'SELECT * FROM aka_lists';
  //   const [table] = await connection.execute(querie);
  //   connection.close();

  //   //cleanup data
  //   const cleanData = table.map((elt) => {
  //     let firstName = null;
  //     let middleName = null;
  //     let lastName = null;
  //     if (elt.firstname != null)
  //       firstName = this.toCapitalizeWord(elt.firstname);
  //     if (elt.middlename != null)
  //       middleName = this.toCapitalizeWord(elt.middlename);
  //     if (elt.lastname != null) lastName = this.toCapitalizeWord(elt.lastname);
  //     return {
  //       id: this.transformId(elt.id),
  //       sanctionedId: this.transformId(elt.sanctioned_id),
  //       category: elt.category,
  //       type: elt.type,
  //       firstName: firstName,
  //       middleName: middleName,
  //       lastName: lastName,
  //       comment: elt.comment,
  //       updatedAt: elt.updated_at,
  //       createdAt: elt.created_at,
  //     };
  //   });

  //   //insert one element to apply MongoDB collection
  //   const { id, ...newData } = cleanData[0];
  //   await this.prisma.akaList.create({
  //     data: newData,
  //   });

  //   //delete all elements in collection
  //   const client = this.getMongoClient();
  //   await this.mongoDeleteMany('AkaList', client).finally(() => client.close());

  //   let data: any[];
  //   let result;
  //   let count = 0;
  //   if (cleanData.length <= 5000) {
  //     result = await this.prisma.akaList.createMany({ data: cleanData });
  //     count += result.count;
  //   } else {
  //     for (let i = 0; i <= cleanData.length; i += 1000) {
  //       if (i >= cleanData.length) i = cleanData.length;
  //       data = cleanData.slice(i, i + 1000);
  //       if (data.length > 0) {
  //         result = await this.prisma.akaList.createMany({ data: data });
  //       }
  //       count += result.count;
  //     }
  //   }
  //   this.logger.log({
  //     message: `${Number(count)} element(s) migrated (AkasList)`,
  //   });
  //   return { AkaListCount: count };
  // }
  // //----- Update database -------
  // async updateAkaListToMongo() {
  //   this.logger.log('Updating AkasList Collection...');
  //   //Get the last updated element from mongoDB
  //   const result = await this.prisma.akaList.findFirst({
  //     orderBy: { updatedAt: 'desc' },
  //     select: { updatedAt: true },
  //   });
  //   const lastDate = this.transformDate(result.updatedAt);
  //   //Get data from MYSQL
  //   const connection = await this.mysqlConnect();
  //   const querie = `SELECT * FROM aka_lists WHERE updated_at > '${lastDate}'`;
  //   const [table] = await connection.execute(querie);

  //   //get MySql data count
  //   const querieCount = `SELECT count(*) as count FROM aka_lists`;
  //   const [mysqlCount] = await connection.execute(querieCount);
  //   connection.close();
  //   this.logger.log(`${mysqlCount[0].count} AkasList element(s) in MySql`);

  //   //get MongoDB data count
  //   const mongoCount = await this.prisma.akaList.count();
  //   this.logger.log(`${mongoCount} AkasList element(s) in MongoDB`);

  //   if (table.length > 0 || mongoCount != mysqlCount[0].count) {
  //     this.logger.log({
  //       message: 'Change detected in Mysql applying updates (AkasList)',
  //     });
  //     // Apply updates
  //     await this.migrateAkaListToMongo();
  //     return {
  //       message: 'Change detected in Mysql applying updates (AkasList)',
  //     };
  //   } else {
  //     this.logger.log({
  //       message: 'No change detected in Mysql (AkasList)',
  //     });
  //     return { message: 'No change detected in Mysql (AkasList)' };
  //   }
  // }

  //=========MySQL connector================
  async mysqlConnect(): Promise<any> {
    //Get the database connection string from dotenv file
    const MYSQL_URL = this.config.get('MYSQL_URL');
    if (!MYSQL_URL)
      throw new InternalServerErrorException(
        'you must provide mysql connection credentials',
      );
    const msqlUrl = JSON.parse(MYSQL_URL);

    return await mysql.createConnection(msqlUrl);
  }

  //=======algorithm that transform id of type BigInt to MongoDB ObjectId======
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

  //toCapitalizeWord()
  toCapitalizeWord(str: string): string {
    const splitStr = str.toLowerCase().split(' ');
    for (let i = 0; i < splitStr.length; i++) {
      splitStr[i] =
        splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
    // Directly return the joined string
    return splitStr.join(' ');
  }

  //Timestamp tranform to string
  transformDate(date: Date): string {
    const TIME_ZONE = this.config.get('TIME_ZONE') || 0;
    const timeZone = Number(TIME_ZONE);
    date.setTime(date.getTime() + timeZone * 60 * 60 * 1000);
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  //tranform date of birth
  formatDate(date) {
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

  getMongoClient() {
    const url = this.config.get('DATABASE_URL');
    const client = new MongoClient(url);
    return client;
  }

  async mongoDeleteMany(collection: string, client: MongoClient) {
    await client.connect();
    console.log('Connected successfully to server');
    const database = client.db('sanctionsexplorer');
    const col = database.collection(collection);
    const deleted = (await col.deleteMany({})).deletedCount;
    return `${Number(deleted)} element(s) deleted`;
  }

  async getFileSource() {
    //manage source directory
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    if (!fs.existsSync(SOURCE_DIR)) {
      fs.mkdirSync(SOURCE_DIR);
      console.log('sanction source directory created');
    }

    //Get DGT sanctions data and write into file
    await this.helper.getSanctionDgt();

    //Get GB (HMT) sanctions data and write into file
    await this.helper.getSanctionGbHmt();

    //Get OFAC sanctions data and write into file
    await this.helper.getSanctionOfac();

    //Get United Nation sanctions data and write into file
    await this.helper.getSanctionUn();

    //Get Canada sanctions data and write into file
    await this.helper.getSanctionCa();

    //Get SECO sanctions data and write into file
    await this.helper.getSanctionSeco();
  }
}
