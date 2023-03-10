import { DateOfBith } from '@prisma/client';

export type Nationality = {
  country: string | null;
  code: string | null;
};

export type Sanction = {
  id: string;
  name: string | null;
};

export class SanctionedEntity {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  type: string;
  originalName: string;
  otherNames: Array<string>;
  sanction: Sanction;
  dateOfBirth?: DateOfBith;
  nationality?: Nationality;
}
