import { Injectable, Logger } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common/exceptions';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderByType } from './type/orderBy.type';

@Injectable()
export class SanctionedService {
  private readonly logger = new Logger(SanctionedService.name);

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  async findAll(
    page?: number,
    limit?: number,
    orderBy?: OrderByType,
    sanctionId?: string,
  ): Promise<any> {
    this.logger.log('finding all sanctioned ordered and paginated...');
    if (sanctionId) {
      if (sanctionId.length != 24)
        throw new BadRequestException('sanctionId length must be equal to 24');
    }
    if (limit) {
      if (typeof limit != 'number')
        throw new BadRequestException('limit length must a number');
    }
    if (page) {
      if (typeof page != 'number')
        throw new BadRequestException('page length must a number');
    }

    //Elements per page
    const PER_PAGE = limit || 20;
    const count: number = (await this.prisma.sanctioned.count()) | 0;
    const order = orderBy ?? 'updatedAt';

    const currentPage: number = Math.max(Number(page) || 1, 1);
    const pageNumber: number = currentPage - 1;

    const lastPage = Math.ceil(count / PER_PAGE);
    let prev = null;
    let next = null;
    if (currentPage != 1) prev = currentPage - 1;
    if (currentPage != lastPage) next = currentPage + 1;

    let ordener;
    if (order == 'firstName') ordener = { firstName: 'asc' };
    if (order == 'lastName') ordener = { lastName: 'asc' };
    if (order == 'updatedAt') ordener = { updatedAt: 'desc' };

    //get elements with their corresponding sanction

    let queryOptions;
    if (sanctionId) {
      queryOptions = {
        where: {
          listId: sanctionId,
        },
        orderBy: ordener,
        include: {
          Sanction: true,
        },
        skip: pageNumber * PER_PAGE,
        take: PER_PAGE,
      };
    } else {
      queryOptions = {
        orderBy: ordener,
        include: {
          Sanction: true,
        },
        skip: pageNumber * PER_PAGE,
        take: PER_PAGE,
      };
    }

    const sanctioned = await this.prisma.sanctioned.findMany(queryOptions);

    const cleanData = sanctioned.map((elt) => {
      return {
        id: elt.id,
        firstName: elt.firstName,
        middleName: elt.middleName,
        lastName: elt.lastName,
        originalName: elt.originalName,
        otherNames: elt.otherNames,
        entityType: elt.type,
        sanctionId: elt.listId,
        sanctioName: elt['Sanction'].name,
      };
    });
    this.logger.log({
      message: `${Number(cleanData.length)} element(s) finded`,
    });
    return {
      data: cleanData,
      meta: {
        total: count,
        lastPage: lastPage,
        currentPage: currentPage,
        perPage: PER_PAGE,
        prev: prev,
        next: next,
      },
    };
  }

  async findOne(id: string) {
    this.logger.log(`finding by id ... \n id = ${id}`);
    const sanctionedData = await this.prisma.sanctioned.findUnique({
      include: {
        akas: true,
        datesOfBirth: true,
        placesOfbirth: true,
        nationalities: true,
        citizenships: true,
        Sanction: true,
      },
      where: {
        id: id,
      },
    });
    return {
      data: sanctionedData,
    };
  }
}
