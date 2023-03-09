import { Test, TestingModule } from '@nestjs/testing';
import { SanctionedService } from './sanctioned.service';

describe('SanctionedService', () => {
  let service: SanctionedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanctionedService],
    }).compile();

    service = module.get<SanctionedService>(SanctionedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
