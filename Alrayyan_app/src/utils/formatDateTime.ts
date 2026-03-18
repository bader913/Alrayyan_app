export const APP_TIME_ZONE = 'Asia/Damascus';

const parseAppDate = (value?: string | number | Date) => {
  if (!value) return new Date();

  if (value instanceof Date) return value;

  if (typeof value === 'number') return new Date(value);

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw.replace(' ', 'T') + 'Z');
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw + 'Z');
  }

  return new Date(raw);
};

export const formatAppDateTime = (value?: string | number | Date) => {
  const date = parseAppDate(value);

  return date.toLocaleString('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

export const formatAppDate = (value?: string | number | Date) => {
  const date = parseAppDate(value);

  return date.toLocaleDateString('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export const formatAppTime = (value?: string | number | Date) => {
  const date = parseAppDate(value);

  return date.toLocaleTimeString('en-US', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};