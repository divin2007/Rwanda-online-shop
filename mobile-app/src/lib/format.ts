export const money = (value?: number | null) => {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${amount.toLocaleString('en-RW')} RWF`;
};

export const compactNumber = (value?: number | null) => {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return amount.toLocaleString('en-RW');
};

export const shortId = (value?: string | null) => {
  if (!value) return '';
  return value.length > 10 ? value.slice(0, 8).toUpperCase() : value.toUpperCase();
};

export const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-RW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const safeText = (value: unknown, fallback = 'Unavailable') => {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

