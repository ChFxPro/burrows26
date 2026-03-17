const numberFormatter = new Intl.NumberFormat('en-US');
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatNumber = (value: number): string => numberFormatter.format(value);

export const formatCurrency = (value: number): string => currencyFormatter.format(value);

export const formatSignedCurrency = (value: number): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatCurrency(value)}`;
};

export const formatPercent = (value: number, decimals = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatSignedPoints = (value: number, decimals = 2): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)} pts`;
};

export const formatSignedPercent = (value: number, decimals = 2): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
};

export const formatIsoDateTime = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};
