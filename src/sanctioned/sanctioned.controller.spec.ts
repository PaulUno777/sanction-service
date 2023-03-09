import { Test, TestingModule } from '@nestjs/testing';
import { SanctionedController } from './sanctioned.controller';
import { SanctionedService } from './sanctioned.service';

describe('SanctionedController', () => {
  let controller: SanctionedController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SanctionedController],
      providers: [SanctionedService],
    }).compile();

    controller = module.get<SanctionedController>(SanctionedController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
