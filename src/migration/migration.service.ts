/* eslint-disable @typescript-eslint/no-var-requires */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoClient } from 'mongodb';
import { MigrationHelper } from './migration.helper';
import { createReadStream, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createInterface } from 'readline';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private helper: MigrationHelper,
  ) {}

  //====== Main method for all Updates =============
  async updateAllToMongo() {
    //delete all elements in collection
    const client = this.getMongoClient();
    await this.mongoDeleteMany('Sanctioned', client).finally(() =>
      client.close(),
    );
    await this.mongoDeleteMany('PoliticallyExposed', client).finally(() =>
      client.close(),
    );
    const result = await Promise.all([
      await this.migrateSanctionList(),
      await this.migrateSanctionedIta(),
      await this.migrateSanctionedDgt(),
      await this.migrateSanctionedUn(),
      await this.migrateSanctionedUe(),
    ]);
    this.logger.log('All is well !');
    return result;
  }

  // //======= Method for sanctionList migration =========
  async migrateSanctionList() {
    this.logger.log('migrating sanction List');
    const data = await this.helper.downloadData('clean_list.json');
    //init MongoDB collection
    const { id, ...oneData } = data[0];
    await this.prisma.sanctionList.create({
      data: oneData,
    });
    //delete all elements in collection
    const client = this.getMongoClient();
    await this.mongoDeleteMany('SanctionList', client).finally(() =>
      client.close(),
    );
    // Apply updates
    const result = await this.prisma.sanctionList.createMany({
      data: data,
    });
    this.logger.log({
      message: `${Number(result.count)} element(s) migrated to SanctionList`,
    });
    return {
      message: `${Number(result.count)} element(s) migrated to SanctionList`,
    };
  }

  async migrateData(list: any[]) {
    //==== migrate all to MongoDB
    //push data in data in batches of 1000 to avoid errors and timeouts
    let data: any[];
    let result;
    let count = 0;
    //ITA
    if (list.length <= 2000) {
      result = await this.prisma.sanctioned.createMany({ data: list });
      count += result.count;
    } else {
      for (let i = 0; i <= list.length; i += 1000) {
        if (i >= list.length) i = list.length;
        data = list.slice(i, i + 1000);
        if (data.length > 0) {
          result = await this.prisma.sanctioned.createMany({ data: data });
        }


        count += result.count;
      }
    }
    return {
      message: `${Number(count)} element(s) migrated`,
    };
  }

  //----- migrate ITA data -------
  async migrateSanctionedIta() {
    this.logger.log('migrationg ITA sanctioned Collection...');
    //Get the data from source file
    const { results } = await this.helper.downloadData('clean_ITA.json');
    //migrate all to MongoDB
    return await this.migrateData(results);
  }

  //----- migrate DGT data -------
  async migrateSanctionedDgt() {
    this.logger.log('migrationg DGT sanctioned Collection...');
    //Get the data from source file
    const { results } = await this.helper.downloadData('clean_DGT.json');
    //migrate all to MongoDB
    return await this.migrateData(results);
  }

  //----- migrate UN data -------
  async migrateSanctionedUn() {
    this.logger.log('migrationg UN sanctioned Collection...');
    //Get the data from source file
    const { results } = await this.helper.downloadData('clean_UN.json');
    //migrate all to MongoDB
    return await this.migrateData(results);
  }

  //----- migrate UN data -------
  async migrateSanctionedUe() {
    this.logger.log('migrationg EU sanctioned Collection...');
    //Get the data from source file
    const { results } = await this.helper.downloadData('clean_UE.json');
    //migrate all to MongoDB
    return await this.migrateData(results);
  }

  //migrate PEPS data
  async migratePep() {
    this.logger.log('migrationg Politically Exposed Person Collection...');
    const list = await this.helper.getPepList()

    //push data in data in batches of 1000 to avoid errors and timeouts
    let data: any[];
    let result;
    let count = 0;
    //ITA
    if (list.length <= 2) {
      result = await this.prisma.politicallyExposed.createMany({ data: list });
      count += result.count;
    } else {
      for (let i = 0; i <= list.length; i += 10) {
        if (i >= list.length) i = list.length;
        data = list.slice(i, i + 10);
        if (data.length > 0) {
          result = await this.prisma.politicallyExposed.createMany({ data: data });
        }


        count += result.count;
      }
    }
    return {
      message: `${Number(count)} element(s) migrated`,
    };
    
  }

  getMongoClient() {
    const url = this.config.get('DATABASE_URL');
    const client = new MongoClient(url);
    return client;
  }

  async mongoDeleteMany(collection: string, client: MongoClient) {
    await client.connect();
    const database = client.db('sanctionsexplorer');
    const col = database.collection(collection);
    const deleted = (await col.deleteMany({})).deletedCount;
    console.log(`${Number(deleted)} element(s) deleted`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async getFileSource() {
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const PUBLIC_DIR = this.config.get('FILE_LOCATION');
    //delete all file in public directory
    rmSync(PUBLIC_DIR, { recursive: true, force: true });

    //get and clean data
    await this.helper.getSanctionIta();
    await this.helper.mapSanctionIta();

    await this.helper.getSanctionDgt();
    await this.helper.mapSanctionDgt();

    await this.helper.getSanctionUn();
    await this.helper.mapSanctionUn();

    await this.helper.getSanctionUe();
    await this.helper.mapSanctionUe();

    //map & write sanction list
    await this.helper.mapSanction();

    //PEPs
    const downloadLink = this.config.get('PEP_SOURCE');
    await this.helper.saveJsonFromJson(downloadLink, 'nested_PEP')

    //apply all unpdate
    await this.updateAllToMongo();

    this.logger.log('All jobs perform  well !');
  }
  async test() {
    return await this.migratePep();
  }
}
