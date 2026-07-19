/**
 * Formats a date object or ISO string into a localized string representation.
 */
export const formatDate = (
  value: string | Date | number | undefined | null,
  locale = 'tr-TR',
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!value) return '-';
  
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };

  return new Intl.DateTimeFormat(locale, options || defaultOptions).format(date);
};

export const formatTimeShort = (
  value: string | Date | number | undefined | null,
  locale = 'tr-TR'
): string => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
