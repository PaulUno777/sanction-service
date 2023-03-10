import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SearchHelper } from './search.helper';

@Module({
  controllers: [SearchController],
  providers: [SearchService, SearchHelper],
})
export class SearchModule {}
