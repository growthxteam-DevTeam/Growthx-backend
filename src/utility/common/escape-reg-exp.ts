// For building an exact, case-insensitive Mongo `$regex` match from user input.
export const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
