import { PartialType } from '@nestjs/swagger';
import { CreateSanctionDto } from './create-sanction.dto';

export class UpdateSanctionDto extends PartialType(CreateSanctionDto) {}
