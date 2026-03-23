const IDENTIFIER_RANDOM_SUFFIX_PATTERN = /(?:[_-])([a-z0-9]{8})$/i;

const normalizeSpaces = (value: string) => value.trim().replace(/\s+/g, ' ');

export const buildTitleFromIdentifier = (
  identifier: string,
  prefix: string
): string => {
  const trimmedIdentifier = normalizeSpaces(identifier);
  if (!trimmedIdentifier) {
    return '';
  }

  const withoutPrefix = trimmedIdentifier.startsWith(prefix)
    ? trimmedIdentifier.slice(prefix.length)
    : trimmedIdentifier;
  const withoutRandomSuffix = withoutPrefix.replace(
    IDENTIFIER_RANDOM_SUFFIX_PATTERN,
    ''
  );

  return normalizeSpaces(withoutRandomSuffix.replace(/[_-]+/g, ' '));
};
