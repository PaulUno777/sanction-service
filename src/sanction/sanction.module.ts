import { Module } from '@nestjs/common';
import { SanctionService } from './sanction.service';
import { SanctionController } from './sanction.controller';

@Module({
  controllers: [SanctionController],
  providers: [SanctionService]
})
export class SanctionModule {}
