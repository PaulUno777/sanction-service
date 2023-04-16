/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type sanctionedType = 'individual' | 'entity' | 'vessel';
export class SearchParamDto {
  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional({
    description: 'match rate in percentage, possibles values: 40 50 60 70 80',
    default: 40,
  })
  matchRate?: number;

  @ApiPropertyOptional({
    description: 'date of birth, availables formats YYYY-MM or YYYY',
  })
  dob?: string;

  @ApiPropertyOptional({
    description: 'natinality is a list of alpha2 or alpha3 ISO 3166 codes',
    example: ['rus'],
  })
  nationality?: string[];

  @ApiPropertyOptional({
    description: 'sanction is a sanctionId',
    example: ['1301234567891234567796'],
  })
  sanction?: string[];

  @ApiPropertyOptional({
    default: 'individual',
    description:
      "type of sanctioned, possibles values: 'entity' or 'individual or 'person'",
  })
  type?: sanctionedType;
}
