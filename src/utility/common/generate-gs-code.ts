import { randomInt } from 'crypto';

// Omits look-alike characters (0/O, 1/I) so the code is easy to read from an email.
const GS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GS_CODE_LENGTH = 12;

export const generateGsCode = (): string =>
  Array.from(
    { length: GS_CODE_LENGTH },
    () => GS_CODE_ALPHABET[randomInt(GS_CODE_ALPHABET.length)],
  ).join('');
