/* eslint-disable @typescript-eslint/no-var-requires */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoClient } from 'mongodb';
import { MigrationHelper } from './migration.helper';
import { existsSync, mkdirSync, readFileSync, readdir, unlink } from 'fs';
import { join } from 'path';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private helper: MigrationHelper,
  ) {}

  //=========Main method for all Updates================
  async updateAllToMongo() {
    const result = await Promise.all([
      await this.updateSantionToMongo(),
      await this.updateSantionedToMongo(),
    ]);
    this.logger.log('All is well !');
    return result;
  }

  // //==== Method for sanctionList migration ================
  async updateSantionToMongo() {
    this.logger.log('Updating sanctionList Collection...');
    //Get the lastest lists
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const jsonFilePath = `${SOURCE_DIR}source_link.json`;
    const cleanData = JSON.parse(readFileSync(jsonFilePath, 'utf8'));

    //insert one element to apply MongoDB collection
    const { id, ...oneData } = cleanData[0];
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
      data: cleanData,
    });
    this.logger.log({
      message: `${Number(result.count)} element(s) updated`,
    });
    return { sanctionListCount: result.count };
  }

  // ===== Method for sanctioned migration ========================
  //----- Update database -------
  async updateSantionedToMongo() {
    this.logger.log('Updating sanctioned Collection...');
    //Get the last updated element from source file
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const jsonFilePath = `${SOURCE_DIR}clean_source.json`;
    const cleanData = JSON.parse(readFileSync(jsonFilePath, 'utf8'));

    //insert one element to apply MongoDB collection
    await this.prisma.sanctioned.create({
      data: cleanData[0],
    });

    //delete all elements in collection
    const client = this.getMongoClient();
    await this.mongoDeleteMany('Sanctioned', client).finally(() =>
      client.close(),
    );

    //migrate all to MongoDB
    //push data in data in batches of 1000 to avoid errors and timeouts
    let data: any[];
    let result;
    let count = 0;
    if (cleanData.length <= 5000) {
      result = await this.prisma.sanctioned.createMany({ data: cleanData });
      count += result.count;
    } else {
      for (let i = 0; i <= cleanData.length; i += 1000) {
        if (i >= cleanData.length) i = cleanData.length;
        data = cleanData.slice(i, i + 1000);
        if (data.length > 0) {
          result = await this.prisma.sanctioned.createMany({ data: data });
        }
        count += result.count;
      }
    }
    this.logger.log({
      message: `${Number(count)} element(s) inserted`,
    });
    return { SantionedCount: count };
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
    //manage source directory
    if (!existsSync(PUBLIC_DIR)) {
      mkdirSync(PUBLIC_DIR);
      console.log('public directory created');
    }
    if (!existsSync(SOURCE_DIR)) {
      mkdirSync(SOURCE_DIR);
      console.log('sanction source directory created');
    }
    //delete all file in directory
    readdir(PUBLIC_DIR, (err, files) => {
      if (err) throw err;
      for (const file of files) {
        unlink(join(PUBLIC_DIR, file), (err) => {
          if (err) throw err;
        });
      }
    });

    await this.helper.getSanctionIta();
    await this.helper.mapSanction();
    await this.helper.mapSanctioned();
    await this.updateAllToMongo();

    this.logger.log('All jobs perform  well !');
  }
}
