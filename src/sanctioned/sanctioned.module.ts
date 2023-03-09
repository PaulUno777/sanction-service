import { Module } from '@nestjs/common';
import { SanctionedService } from './sanctioned.service';
import { SanctionedController } from './sanctioned.controller';

@Module({
  controllers: [SanctionedController],
  providers: [SanctionedService]
})
export class SanctionedModule {}
