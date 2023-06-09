import { DateObject } from '@prisma/client';

export type Nationality = {
  country: string;
  isoCode: string;
};

export type Sanction = {
  id: string;
  name: string;
};

export class SanctionedEntity {
  id: string;
  defaultName: string;
  type: string;
  remarks: string;
  sanction: Sanction;
  publicationUrl: string;
  dateOfBirth?: DateObject;
  nationality?: Nationality[];
}
