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
  defaultName: string;
  type: string;
  originalName: string;
  otherNames: Array<string>;
  dateOfBirth?: DateOfBith;
  nationality?: Nationality;
}
