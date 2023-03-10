import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SanctionService {
  constructor(private prisma: PrismaService) {}
  async findAll() {
    const sanctions = await this.prisma.sanctionList.findMany({
      orderBy: {
        name: 'desc',
      },
    });
    return sanctions.map((item) => {
      return {
        id: item.id,
        name: item.name,
      };
    });
  }
}
