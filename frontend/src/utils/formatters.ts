const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(
  "ru-RU",
  {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
);

export function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : dateFormatter.format(date);
}

export function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : dateTimeFormatter.format(date);
}

export function formatAmount(
  value: string | null | undefined,
  currency = "BYN",
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${value} ${currency}`;
  }

  return `${amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function formatFileSize(
  value: number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined ||
    value < 0
  ) {
    return "—";
  }

  if (value < 1024) {
    return `${value} Б`;
  }

  const kilobytes = value / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toLocaleString("ru-RU", {
      maximumFractionDigits: kilobytes < 10 ? 1 : 0,
    })} КБ`;
  }

  const megabytes = kilobytes / 1024;
  return `${megabytes.toLocaleString("ru-RU", {
    maximumFractionDigits: megabytes < 10 ? 1 : 0,
  })} МБ`;
}
