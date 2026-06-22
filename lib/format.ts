// Central display formatters. The whole platform shows **Latin (Western) digits**
// for clarity — even in Arabic — by forcing the `latn` numbering system via the
// BCP-47 `-u-nu-latn` extension, while still honoring locale conventions
// (month names, currency placement). Prices additionally drop the thousands
// separator. Counts keep grouping.

function latn(locale: string): string {
  return /-u-nu-/.test(locale) ? locale : `${locale}-u-nu-latn`;
}

// Whole numbers / counts — Latin digits, grouping kept (e.g. 5,000,000).
export function formatNumber(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(latn(locale), { maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0
  );
}

// Money (SAR) — Latin digits, NO thousands separator (e.g. SAR 1200.00).
export function formatSar(amount: number, locale = 'en'): string {
  return new Intl.NumberFormat(latn(locale), {
    style: 'currency',
    currency: 'SAR',
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

// Date/time — Latin digits, locale-aware labels.
export function formatDateTime(
  date: Date | string,
  locale = 'en',
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(latn(locale), opts);
}

export function formatDate(
  date: Date | string,
  locale = 'en',
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(latn(locale), opts);
}
