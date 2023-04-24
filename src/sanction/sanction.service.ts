import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SanctionService {
  private readonly logger = new Logger(SanctionService.name);
  constructor(private prisma: PrismaService) {}
  async findAll() {
    this.logger.log('Getting sanction list ...');
    const sanctions = await this.prisma.sanctionList.findMany({
      orderBy: {
        id: 'asc',
      },
    });
    this.logger.log('(success !) all is well');
    return sanctions.map((item) => {
      return {
        id: item.id,
        name: item.name,
      };
    });
  }
}
