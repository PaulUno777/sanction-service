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
        throw new BadRequestException('page length must be a number');
    }
    if (orderBy) {
      const orders = ['asc', 'desc', 'ASC', 'DESC', 'Asc', 'Desc'];
      if (!orders.includes(orderBy))
        throw new BadRequestException(
          'possibles values of orderBy are firstName lastName updatedAt',
        );
    }

    //Elements per page
    const PER_PAGE = limit || 20;
    const count: number = (await this.prisma.sanctioned.count()) | 0;
    const order = orderBy;

    const currentPage: number = Math.max(Number(page) || 1, 1);
    const pageNumber: number = currentPage - 1;

    const lastPage = Math.ceil(count / PER_PAGE);
    let prev = null;
    let next = null;
    if (currentPage != 1) prev = currentPage - 1;
    if (currentPage != lastPage) next = currentPage + 1;

    //set order
    let ordener;
    if (order) {
      const cleanOrder = order.toLowerCase();
      if (cleanOrder == 'asc') ordener = { defaultName: 'asc' };
      if (cleanOrder == 'desc') ordener = { defaultName: 'desc' };
    } else {
      ordener = { defaultName: 'asc' };
    }

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
    console.log(queryOptions);
    const cleanData = sanctioned.map((elt) => {
      return {
        id: elt.id,
        entityType: elt.type,
        sanctionId: elt.listId,
        defaultName: elt['defaultName'],
        otherNames: elt['akas'],
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
      where: {
        id: id,
      },
    });
    return {
      data: sanctionedData,
    };
  }
}
