/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type sanctionedType = 'individual' | 'entity' | 'person';
export class SearchParamDto {
  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional({
    description: 'match rate in percentage, possibles values: 50 60 70 80',
    default: 50
  })
  matchRate?: number;

  @ApiPropertyOptional({
    description: 'date of birth, availables formats YYYY-MM or YYYY'
  })
  dob?: string;

  @ApiPropertyOptional({
    description: 'natinality is a list of alpha2 or alpha3 ISO 3166 codes',
    example: ['rus', 'fr', 'cm']
  })
  nationality?: string[];

  @ApiPropertyOptional()
  sanctionId?: string;

  @ApiPropertyOptional({
    default: 'individual',
    description: 'type of sanctioned, possibles values: \'entity\' or \'individual\ or \'person\''
  })
  type?: sanctionedType;
}
