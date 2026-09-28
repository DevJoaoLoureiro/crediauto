/*
 * =========================================================
 * FORMATADORES PARTILHADOS
 *
 * Os formatadores são criados uma única vez.
 *
 * O fuso horário é fixo para que o HTML gerado no servidor
 * (UTC) seja igual ao do browser e não haja erros de hidratação.
 * =========================================================
 */

const TIME_ZONE = 'Europe/Lisbon';

const currencyFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

const shortMonthDateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

function toValidDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '—';
  }

  return currencyFormatter.format(Number(value));
}

/** 28/09/2026 */
export function formatDate(value: string | Date | null | undefined) {
  const date = toValidDate(value);

  return date ? dateFormatter.format(date) : '—';
}

/** 28/set/2026 */
export function formatShortMonthDate(
  value: string | Date | null | undefined,
) {
  const date = toValidDate(value);

  return date ? shortMonthDateFormatter.format(date) : '—';
}

/** 28/09/2026, 14:30 */
export function formatDateTime(value: string | Date | null | undefined) {
  const date = toValidDate(value);

  return date ? dateTimeFormatter.format(date) : '—';
}

export function formatFileSize(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || bytes <= 0) {
    return '';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

/*
 * Fora do corpo dos componentes para respeitar
 * a regra de pureza do React (Date.now é impuro).
 */
export function isExpired(value: string | Date) {
  const date = toValidDate(value);

  return !date || date.getTime() <= Date.now();
}

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
});

/** Data de hoje em Lisboa no formato YYYY-MM-DD (comparável com colunas date). */
export function todayIsoDate() {
  return isoDateFormatter.format(new Date());
}

/** Soma dias a uma data YYYY-MM-DD. */
export function addDaysIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Dias de `from` até `to` (ambos YYYY-MM-DD). Negativo se `to` já passou. */
export function daysBetweenIsoDates(from: string, to: string) {
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}
