import { companies, companyCountryHsMetrics, companyTradeRows, countries, countryMetrics, hsCodes, months } from "./mockData";
import type { Company, Country, MetricKey, TrendDirection } from "./types";

export type CountrySummary = {
  code: string;
  name: string;
  metricTotal: number;
  importersCount: number;
  share: number;
  trend: TrendDirection;
  changePct: number;
};

export type CompanySummary = {
  id: string;
  name: string;
  countryCode: string;
  buyerType?: Company["buyerType"];
  industry?: string;
  website?: string;
  metricTotal: number;
  shipmentsCount: number;
  frequency: number;
  trend: TrendDirection;
  changePct: number;
  lastActiveDate?: string;
};

export type TradeHistoryRow = {
  month: string;
  originCountry?: string;
  counterparty?: string;
  weightKg: number;
  shipmentsCount?: number;
  valueUsd?: number;
};

export const metricOptions: { key: MetricKey; label: string; shortLabel: string }[] = [
  { key: "weightKg", label: "Total Weight (KG)", shortLabel: "Weight (KG)" },
  { key: "valueUsd", label: "Total Value (USD)", shortLabel: "Value (USD)" },
];

const toWords = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const toTitle = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");

const getDomainFromUrl = (url?: string) => {
  if (!url) return "";
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const hashString = (value: string) =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 1000000007, 7);

const withFallbackContact = (company: Company): Company => {
  const words = toWords(company.name);
  const readableName = toTitle(words.slice(0, 2).join(" "));
  const websiteDomain =
    getDomainFromUrl(company.website) ||
    `${(words.slice(-2).join("-") || "company").replace(/^-+|-+$/g, "")}.example.com`;
  const country = countries.find((item) => item.code === company.countryCode);
  const phoneSeed = String((hashString(company.id) % 9000000) + 1000000);
  const countryPrefixMap: Record<string, string> = {
    BD: "+880",
    CA: "+1",
    ID: "+62",
    US: "+1",
    VN: "+84",
    ZW: "+263",
  };
  const prefix = countryPrefixMap[company.countryCode] ?? "+1";

  return {
    ...company,
    contacts: {
      person: company.contacts?.person ?? `${readableName || "Sales"} Team`,
      email:
        company.contacts?.email ??
        `sales@${websiteDomain.replace(/[^a-z0-9.-]/g, "")}`,
      phone:
        company.contacts?.phone ??
        `${prefix} ${phoneSeed.slice(0, 3)}-${phoneSeed.slice(3)}`,
      website: company.contacts?.website ?? company.website ?? `https://${websiteDomain}`,
      linkedIn:
        company.contacts?.linkedIn ??
        `https://www.linkedin.com/company/${company.id}`,
    },
    industry: company.industry ?? `${country?.name ?? "Global"} Trading`,
  };
};

const companyById = new Map(companies.map((company) => [company.id, withFallbackContact(company)]));

export const getHsCodeByCode = (code: string) => hsCodes.find((hs) => hs.code === code);
export const getCountryByCode = (code: string) => countries.find((country) => country.code === code);
export const getCompanyById = (id: string) => companyById.get(id);

export const getAvailableMonths = (hsCode: string) => {
  const set = new Set(
    countryMetrics
      .filter((row) => row.hsCode === hsCode)
      .map((row) => row.month),
  );
  return Array.from(set).sort();
};

export const getMonthRange = (allMonths: string[], start: string, end: string) => {
  const startIndex = Math.max(0, allMonths.indexOf(start));
  const endIndex = Math.max(startIndex, allMonths.indexOf(end));
  return allMonths.slice(startIndex, endIndex + 1);
};

const getTrend = (
  seriesMonths: string[],
  endMonth: string,
  getValue: (month: string) => number,
) => {
  const endIndex = seriesMonths.indexOf(endMonth);
  if (endIndex < 0) return { trend: "neutral" as TrendDirection, changePct: 0 };

  const last12 = seriesMonths.slice(Math.max(0, endIndex - 11), endIndex + 1);
  const prev12 = seriesMonths.slice(Math.max(0, endIndex - 23), Math.max(0, endIndex - 11));

  if (prev12.length < 6 || last12.length < 6) {
    return { trend: "neutral" as TrendDirection, changePct: 0 };
  }

  const sum = (monthsToSum: string[]) =>
    monthsToSum.reduce((acc, month) => acc + getValue(month), 0);

  const lastTotal = sum(last12);
  const prevTotal = sum(prev12);

  if (prevTotal === 0) return { trend: "neutral" as TrendDirection, changePct: 0 };

  const changePct = ((lastTotal - prevTotal) / prevTotal) * 100;
  if (changePct > 4) return { trend: "up" as TrendDirection, changePct };
  if (changePct < -4) return { trend: "down" as TrendDirection, changePct };
  return { trend: "neutral" as TrendDirection, changePct };
};

export const getCountrySummaries = (params: {
  hsCode: string;
  startMonth: string;
  endMonth: string;
  metricKey: MetricKey;
}) => {
  const { hsCode, startMonth, endMonth, metricKey } = params;
  const seriesMonths = getAvailableMonths(hsCode);
  const selectedMonths = getMonthRange(seriesMonths, startMonth, endMonth);

  const rows = countryMetrics.filter(
    (row) => row.hsCode === hsCode && selectedMonths.includes(row.month),
  );

  const grouped = new Map<string, { metricTotal: number; importersCount: number }>();

  rows.forEach((row) => {
    const entry = grouped.get(row.countryCode) ?? { metricTotal: 0, importersCount: 0 };
    const metricValue = metricKey === "valueUsd" ? row.valueUsd ?? 0 : row.weightKg;
    entry.metricTotal += metricValue;
    entry.importersCount += row.importersCount;
    grouped.set(row.countryCode, entry);
  });

  const globalTotal = Array.from(grouped.values()).reduce(
    (sum, entry) => sum + entry.metricTotal,
    0,
  );

  const summaries = Array.from(grouped.entries()).map(([code, entry]) => {
    const country = getCountryByCode(code) as Country;
    const importersCount = selectedMonths.length
      ? Math.round(entry.importersCount / selectedMonths.length)
      : entry.importersCount;

    const trend = getTrend(seriesMonths, endMonth, (month) => {
      const monthRows = countryMetrics.filter(
        (row) => row.hsCode === hsCode && row.countryCode === code && row.month === month,
      );
      return monthRows.reduce((acc, row) => {
        const metricValue = metricKey === "valueUsd" ? row.valueUsd ?? 0 : row.weightKg;
        return acc + metricValue;
      }, 0);
    });

    return {
      code,
      name: country?.name ?? code,
      metricTotal: entry.metricTotal,
      importersCount,
      share: globalTotal ? (entry.metricTotal / globalTotal) * 100 : 0,
      trend: trend.trend,
      changePct: trend.changePct,
    } as CountrySummary;
  });

  return summaries;
};

export const getCompanySummaries = (params: {
  hsCode: string;
  countryCode: string;
  startMonth: string;
  endMonth: string;
  metricKey: MetricKey;
}) => {
  const { hsCode, countryCode, startMonth, endMonth, metricKey } = params;
  const seriesMonths = months;
  const selectedMonths = getMonthRange(seriesMonths, startMonth, endMonth);

  const companyIds = companies
    .filter((company) => company.countryCode === countryCode)
    .map((company) => company.id);

  const rows = companyCountryHsMetrics.filter(
    (row) =>
      row.hsCode === hsCode &&
      companyIds.includes(row.companyId) &&
      selectedMonths.includes(row.month),
  );

  const grouped = new Map<string, {
    metricTotal: number;
    shipmentsCount: number;
    frequency: number;
    lastActiveDate?: string;
  }>();

  rows.forEach((row) => {
    const entry = grouped.get(row.companyId) ?? {
      metricTotal: 0,
      shipmentsCount: 0,
      frequency: 0,
      lastActiveDate: row.lastActiveDate,
    };

    const metricValue = metricKey === "valueUsd" ? row.valueUsd ?? 0 : row.weightKg;
    entry.metricTotal += metricValue;
    entry.shipmentsCount += row.shipmentsCount ?? 0;
    entry.frequency += 1;
    if (row.lastActiveDate && (!entry.lastActiveDate || row.lastActiveDate > entry.lastActiveDate)) {
      entry.lastActiveDate = row.lastActiveDate;
    }

    grouped.set(row.companyId, entry);
  });

  const summaries = Array.from(grouped.entries()).map(([companyId, entry]) => {
    const company = getCompanyById(companyId) as Company;

    const trend = getTrend(seriesMonths, endMonth, (month) => {
      const monthRows = companyCountryHsMetrics.filter(
        (row) => row.hsCode === hsCode && row.companyId === companyId && row.month === month,
      );
      return monthRows.reduce((acc, row) => {
        const metricValue = metricKey === "valueUsd" ? row.valueUsd ?? 0 : row.weightKg;
        return acc + metricValue;
      }, 0);
    });

    return {
      id: companyId,
      name: company?.name ?? companyId,
      countryCode: company?.countryCode ?? "",
      buyerType: company?.buyerType,
      industry: company?.industry,
      website: company?.website,
      metricTotal: entry.metricTotal,
      shipmentsCount: entry.shipmentsCount,
      frequency: entry.frequency,
      trend: trend.trend,
      changePct: trend.changePct,
      lastActiveDate: entry.lastActiveDate,
    } as CompanySummary;
  });

  return summaries;
};

export const getCompanyTradeHistory = (params: {
  companyId: string;
  hsCode: string;
  startMonth: string;
  endMonth: string;
}) => {
  const { companyId, hsCode, startMonth, endMonth } = params;
  const selectedMonths = getMonthRange(months, startMonth, endMonth);

  const rows = companyTradeRows.filter(
    (row) =>
      row.companyId === companyId &&
      row.hsCode === hsCode &&
      selectedMonths.some((month) => row.date.startsWith(month)),
  );

  const grouped = new Map<string, TradeHistoryRow>();

  rows.forEach((row) => {
    const month = row.date.slice(0, 7);
    const entry = grouped.get(month) ?? {
      month,
      originCountry: row.originCountry,
      counterparty: row.counterparty,
      weightKg: 0,
      shipmentsCount: 0,
      valueUsd: 0,
    };

    entry.weightKg += row.weightKg;
    entry.shipmentsCount = (entry.shipmentsCount ?? 0) + (row.shipmentsCount ?? 0);
    entry.valueUsd = (entry.valueUsd ?? 0) + (row.valueUsd ?? 0);

    if (entry.originCountry && row.originCountry && entry.originCountry !== row.originCountry) {
      entry.originCountry = "Multiple";
    }
    if (entry.counterparty && row.counterparty && entry.counterparty !== row.counterparty) {
      entry.counterparty = "Multiple";
    }

    grouped.set(month, entry);
  });

  const history = Array.from(grouped.values()).sort((a, b) => (a.month > b.month ? -1 : 1));
  if (history.length > 0) return history;

  const company = getCompanyById(companyId);
  const countryName = company?.countryCode ? getCountryByCode(company.countryCode)?.name : undefined;

  const syntheticRows = companyCountryHsMetrics.filter(
    (row) =>
      row.companyId === companyId &&
      row.hsCode === hsCode &&
      selectedMonths.includes(row.month),
  );

  if (!syntheticRows.length) return [];

  const syntheticGrouped = new Map<string, TradeHistoryRow>();

  syntheticRows.forEach((row) => {
    const entry = syntheticGrouped.get(row.month) ?? {
      month: row.month,
      originCountry: countryName ?? "Not available",
      counterparty: company?.name ?? "Not available",
      weightKg: 0,
      shipmentsCount: 0,
      valueUsd: 0,
    };

    entry.weightKg += row.weightKg;
    entry.shipmentsCount = (entry.shipmentsCount ?? 0) + (row.shipmentsCount ?? 1);
    entry.valueUsd = (entry.valueUsd ?? 0) + (row.valueUsd ?? 0);

    syntheticGrouped.set(row.month, entry);
  });

  return Array.from(syntheticGrouped.values()).sort((a, b) => (a.month > b.month ? -1 : 1));
};

export const formatMonthLabel = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1, 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
};
