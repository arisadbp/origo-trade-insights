import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { BuyerType, Company, HsCode, TradeHistoryRow, TrendDirection } from "./types";

type CompanyOverviewRow = {
  id?: string;
  company_id: string;
  company_introduction: string | null;
  business_overview: string | null;
  employee_size: number | null;
  procurement_overview: string | null;
  total_purchase_value: number | string | null;
  purchase_value_last_12m: number | string | null;
  purchase_frequency_per_year: number | null;
  latest_purchase_date: string | null;
  purchase_interval_days: number | null;
  is_active: boolean | null;
  trade_start_date: string | null;
  trade_end_date: string | null;
  core_products: string[] | null;
  core_supplier_countries: string[] | null;
  core_suppliers: string[] | null;
  growth_rate_last_3m: number | string | null;
  yoy_growth_rate: number | string | null;
  recent_trends?: number | string | null;
  purchasing_trend?: number | string | null;
  purchase_stability: string | null;
  purchase_activity?: string | null;
  purchase_activity_label: string | null;
  indicator_review: string | null;
  procurement_structure: string | null;
  updated_at: string | null;
};

type CompanyBasicInfoRow = {
  company_id: string;
  company_name: string | null;
  location: string | null;
  website: string | null;
  twitter: string | null;
  instagram: string | null;
  facebook: string | null;
  updated_at: string | null;
};

type CompanyContactRow = {
  id?: string;
  company_id: string;
  name: string | null;
  position: string | null;
  department: string | null;
  employment_date: string | null;
  business_email: string | null;
  supplement_email_1: string | null;
  supplement_email_2: string | null;
  social_media: string | null;
  region: string | null;
  created_at: string | null;
};

type PurchaseTrendRow = {
  id?: string;
  company_id: string;
  date: string | null;
  importer: string | null;
  exporter: string | null;
  hs_code: string | null;
  product: string | null;
  product_description: string | null;
  origin_country: string | null;
  destination_country: string | null;
  total_price_usd: number | string | null;
  weight_kg: number | string | null;
  quantity: number | string | null;
  unit_price_usd_kg: number | string | null;
  unit_price_usd_qty: number | string | null;
  quantity_unit: string | null;
  created_at: string | null;
};

type CompaniesRow = {
  company_id: string;
  customer_name?: string | null;
  customer_location?: string | null;
  customer?: string | null;
  location?: string | null;
  website?: string | null;
  trades?: number | string | null;
  supplier_number?: number | string | null;
  value_tag?: string | null;
  latest_purchase_time?: string | null;
  product?: string | null;
  product_description?: string | null;
  created_at?: string | null;
  status: string | null;
};

type NormalizedPurchaseRow = {
  companyId: string;
  date: string;
  month: string;
  hsCode: string;
  hsCodeFamily: string;
  product?: string;
  productDescription?: string;
  importer?: string;
  exporter?: string;
  originCountry?: string;
  destinationCountry?: string;
  totalPriceUsd: number;
  weightKg: number;
  quantity: number;
};

type CompanyRecord = {
  id: string;
  company: Company;
  countryName?: string;
  status: "new" | "existing";
  overview?: CompanyOverviewRow;
  basicInfo?: CompanyBasicInfoRow;
  contacts: CompanyContactRow[];
};

export type CompanyListSummary = {
  id: string;
  name: string;
  countryCode: string;
  buyerType?: BuyerType;
  industry?: string;
  website?: string;
  metricTotal: number;
  shipmentsCount: number;
  frequency: number;
  trend: TrendDirection;
  changePct: number;
  lastActiveDate?: string;
  status: "new" | "existing";
  tradeSum: number;
  product?: string;
  productDescription?: string;
};

export type CompanyListDataset = {
  companies: CompanyRecord[];
  purchases: NormalizedPurchaseRow[];
  countryNameByCode: Record<string, string>;
};

const DEFAULT_BUYER_TYPE: BuyerType = "Importer";
const NEW_COMPANY_DAYS = 365;
const PAGE_SIZE = 1000;
const FALLBACK_HS_CODE = "170199";
const FALLBACK_PRODUCT_NAME = "Refined Sugar";

let countryNameToCodeCache: Map<string, string> | null = null;
let countryCodeToNameCache: Map<string, string> | null = null;

const normalizeCountryKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|republic of|state of|states of|kingdom of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ensureCountryCaches = () => {
  if (countryNameToCodeCache && countryCodeToNameCache) return;

  const nameToCode = new Map<string, string>();
  const codeToName = new Map<string, string>();

  if (typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined") {
    const display = new Intl.DisplayNames(["en"], { type: "region" });
    for (let first = 65; first <= 90; first += 1) {
      for (let second = 65; second <= 90; second += 1) {
        const code = String.fromCharCode(first, second);
        const name = display.of(code);
        if (!name || name === code || /\d/.test(name)) continue;
        const key = normalizeCountryKey(name);
        if (key && !nameToCode.has(key)) {
          nameToCode.set(key, code);
        }
        if (!codeToName.has(code)) {
          codeToName.set(code, name);
        }
      }
    }
  }

  const aliasMap: Record<string, string> = {
    usa: "US",
    us: "US",
    "united states of america": "US",
    uk: "GB",
    "u.k": "GB",
    "u.k.": "GB",
    "united kingdom": "GB",
    korea: "KR",
    "south korea": "KR",
    "north korea": "KP",
    russia: "RU",
    vietnam: "VN",
    laos: "LA",
    bolivia: "BO",
    tanzania: "TZ",
    moldova: "MD",
    syria: "SY",
    uganda: "UG",
    "ivory coast": "CI",
    "cote d ivoire": "CI",
  };

  Object.entries(aliasMap).forEach(([name, code]) => {
    nameToCode.set(normalizeCountryKey(name), code);
  });

  countryNameToCodeCache = nameToCode;
  countryCodeToNameCache = codeToName;
};

const countryNameFromCode = (code: string) => {
  ensureCountryCaches();
  return countryCodeToNameCache?.get(code.toUpperCase());
};

const resolveCountry = (location?: string | null) => {
  const value = (location ?? "").trim();
  if (!value) {
    return { countryCode: "", countryName: "" };
  }

  if (/^[A-Za-z]{2}$/.test(value)) {
    const code = value.toUpperCase();
    return {
      countryCode: code,
      countryName: countryNameFromCode(code) ?? code,
    };
  }

  ensureCountryCaches();
  const candidates = [
    value,
    ...value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .reverse(),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCountryKey(candidate);
    const code = countryNameToCodeCache?.get(normalized);
    if (code) {
      return {
        countryCode: code,
        countryName: countryNameFromCode(code) ?? candidate,
      };
    }
  }

  return { countryCode: "", countryName: value };
};

const normalizeUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const normalizeHsCode = (value?: string | null) => (value ?? "").replace(/\D+/g, "");

const normalizeDate = (value?: string | null) => {
  const raw = value?.trim();
  if (!raw) return "";
  const direct = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const pickFirstText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
};

const hsCodeFromText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const digits = normalizeHsCode(value);
    if (digits.length >= 6) return digits.slice(0, 6);
  }
  return "";
};

const hsFamily = (value?: string | null) => normalizeHsCode(value).slice(0, 6);

const isSameHsFamily = (a?: string | null, b?: string | null) => {
  const familyA = hsFamily(a);
  const familyB = hsFamily(b);
  return Boolean(familyA && familyB && familyA === familyB);
};

const numeric = (value: number | string | null | undefined) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const uniqueBy = <T,>(items: T[], keyFn: (item: T) => string) => {
  const map = new Map<string, T>();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
};

const fetchAllRows = async <T extends Record<string, unknown>>(
  table: string,
  columns: string,
  orderColumn?: string,
) => {
  if (!supabase) {
    throw new Error("Supabase client is not initialized.");
  }

  const rows: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true });
    }
    const { data, error } = await query;

    if (error) {
      const tableError = new Error(`${table}: ${error.message}`) as Error & { code?: string };
      tableError.code = error.code;
      throw tableError;
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
};

const isMissingTableError = (error: unknown) => {
  const code = (error as { code?: string } | undefined)?.code;
  if (code === "PGRST205" || code === "42P01") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /could not find the table|relation .* does not exist|schema cache/i.test(message);
};

const fetchAllRowsOptional = async <T extends Record<string, unknown>>(
  table: string,
  columns = "*",
  orderColumn?: string,
) => {
  try {
    return await fetchAllRows<T>(table, columns, orderColumn);
  } catch (error) {
    if (isMissingTableError(error)) {
      return [] as T[];
    }
    throw error;
  }
};

const fetchCompaniesTableRows = async () => {
  try {
    return await fetchAllRows<CompaniesRow>("supabase_companies", "*");
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }
  return fetchAllRowsOptional<CompaniesRow>("companies", "*");
};

const fetchPurchaseRows = async () => {
  try {
    return await fetchAllRows<PurchaseTrendRow>("purchase_trend", "*", "date");
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }
  return fetchAllRowsOptional<PurchaseTrendRow>("purchase_trends", "*", "date");
};

const isNewCompany = (tradeStartDate?: string | null) => {
  if (!tradeStartDate) return false;
  const ts = new Date(tradeStartDate).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= NEW_COMPANY_DAYS * 24 * 60 * 60 * 1000;
};

const mapCompaniesStatusToAppStatus = (value?: string | null): "new" | "existing" | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;

  if (
    normalized === "yellow" ||
    normalized === "new" ||
    normalized.includes("high-potential") ||
    normalized.includes("high potential")
  ) {
    return "new";
  }

  if (
    normalized === "green" ||
    normalized === "existing" ||
    normalized.includes("general") ||
    normalized === "active" ||
    normalized === "mixed" ||
    normalized === "red"
  ) {
    return "existing";
  }

  return undefined;
};

const modeBy = <T,>(items: T[], pick: (item: T) => string | undefined) => {
  const counter = new Map<string, number>();
  items.forEach((item) => {
    const value = pick(item);
    if (!value) return;
    counter.set(value, (counter.get(value) ?? 0) + 1);
  });
  const sorted = Array.from(counter.entries()).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0];
};

const computeTrend = (months: string[], monthlyTotals: Map<string, number>, endMonth: string) => {
  const endIndex = months.indexOf(endMonth);
  if (endIndex < 0) return { trend: "neutral" as TrendDirection, changePct: 0 };

  const last12 = months.slice(Math.max(0, endIndex - 11), endIndex + 1);
  const prev12 = months.slice(Math.max(0, endIndex - 23), Math.max(0, endIndex - 11));

  if (last12.length < 6 || prev12.length < 6) {
    return { trend: "neutral" as TrendDirection, changePct: 0 };
  }

  const total = (keys: string[]) => keys.reduce((sum, month) => sum + (monthlyTotals.get(month) ?? 0), 0);
  const lastTotal = total(last12);
  const prevTotal = total(prev12);
  if (prevTotal === 0) return { trend: "neutral" as TrendDirection, changePct: 0 };

  const changePct = ((lastTotal - prevTotal) / prevTotal) * 100;
  if (changePct > 4) return { trend: "up" as TrendDirection, changePct };
  if (changePct < -4) return { trend: "down" as TrendDirection, changePct };
  return { trend: "neutral" as TrendDirection, changePct };
};

const inMonthRange = (month: string, startMonth: string, endMonth: string) =>
  month >= startMonth && month <= endMonth;

const pickPrimaryContact = (contacts: CompanyContactRow[]) =>
  contacts.find((row) => row.business_email) ?? contacts.find((row) => row.supplement_email_1) ?? contacts[0];

export const loadCompanyListDataset = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const [overviews, basics, contacts, purchases, companiesTableRows] = await Promise.all([
    fetchAllRowsOptional<CompanyOverviewRow>("company_overview", "*"),
    fetchAllRowsOptional<CompanyBasicInfoRow>("company_basic_info", "*"),
    fetchAllRowsOptional<CompanyContactRow>("company_contacts", "*", "created_at"),
    fetchPurchaseRows(),
    fetchCompaniesTableRows(),
  ]);

  const overviewByCompanyId = new Map(overviews.map((row) => [row.company_id, row]));
  const basicByCompanyId = new Map(basics.map((row) => [row.company_id, row]));
  const companiesTableByCompanyId = new Map(companiesTableRows.map((row) => [row.company_id, row]));
  const contactsByCompanyId = new Map<string, CompanyContactRow[]>();
  contacts.forEach((contact) => {
    const list = contactsByCompanyId.get(contact.company_id) ?? [];
    list.push(contact);
    contactsByCompanyId.set(contact.company_id, list);
  });

  const companyIds = uniqueBy(
    [
      ...overviews.map((row) => row.company_id),
      ...basics.map((row) => row.company_id),
      ...contacts.map((row) => row.company_id),
      ...purchases.map((row) => row.company_id),
      ...companiesTableRows.map((row) => row.company_id),
    ]
      .filter(Boolean)
      .map((id) => ({ id })),
    (row) => row.id,
  ).map((row) => row.id);

  const countryNameByCode: Record<string, string> = {};
  const companies: CompanyRecord[] = companyIds.map((companyId) => {
    const overview = overviewByCompanyId.get(companyId);
    const basicInfo = basicByCompanyId.get(companyId);
    const companyTableRow = companiesTableByCompanyId.get(companyId);
    const allContacts = contactsByCompanyId.get(companyId) ?? [];
    const contact = pickPrimaryContact(allContacts);
    const importerName = purchases.find((row) => row.company_id === companyId)?.importer ?? undefined;

    const companyName =
      pickFirstText(
        basicInfo?.company_name,
        companyTableRow?.customer_name,
        companyTableRow?.customer,
        importerName,
      ) ?? `Company ${companyId.slice(0, 8)}`;

    const resolvedCountry = resolveCountry(
      basicInfo?.location ??
        contact?.region ??
        companyTableRow?.customer_location ??
        companyTableRow?.location,
    );
    if (resolvedCountry.countryCode && resolvedCountry.countryName) {
      countryNameByCode[resolvedCountry.countryCode] = resolvedCountry.countryName;
    }

    const website = normalizeUrl(pickFirstText(basicInfo?.website, companyTableRow?.website));
    const socialLinks = [
      contact?.social_media,
      basicInfo?.twitter,
      basicInfo?.instagram,
      basicInfo?.facebook,
    ]
      .map((value) => normalizeUrl(value))
      .filter(Boolean) as string[];

    const linkedIn =
      socialLinks.find((url) => /linkedin\.com/i.test(url)) ??
      socialLinks.find((url) => /twitter\.com|x\.com/i.test(url)) ??
      socialLinks[0];

    const industry = overview?.business_overview?.slice(0, 120)?.trim() || undefined;

    return {
      id: companyId,
      company: {
        id: companyId,
        name: companyName,
        countryCode: resolvedCountry.countryCode,
        buyerType: DEFAULT_BUYER_TYPE,
        industry,
        website,
        contacts: {
          person: contact?.name?.trim() || undefined,
          email:
            contact?.business_email?.trim() ||
            contact?.supplement_email_1?.trim() ||
            contact?.supplement_email_2?.trim() ||
            undefined,
          website,
          linkedIn,
        },
      },
      countryName: resolvedCountry.countryName || undefined,
      status:
        mapCompaniesStatusToAppStatus(pickFirstText(companyTableRow?.status, companyTableRow?.value_tag)) ??
        (isNewCompany(overview?.trade_start_date) ? "new" : "existing"),
      overview,
      basicInfo,
      contacts: allContacts,
    };
  });

  const normalizedPurchasesFromTrend = purchases
    .map((row) => {
      const date = row.date?.slice(0, 10) ?? "";
      const hsCode = normalizeHsCode(row.hs_code);
      if (!date || !hsCode || !row.company_id) return null;
      return {
        companyId: row.company_id,
        date,
        month: date.slice(0, 7),
        hsCode,
        hsCodeFamily: hsFamily(hsCode),
        product: row.product ?? undefined,
        productDescription: row.product_description ?? undefined,
        importer: row.importer ?? undefined,
        exporter: row.exporter ?? undefined,
        originCountry: row.origin_country ?? undefined,
        destinationCountry: row.destination_country ?? undefined,
        totalPriceUsd: numeric(row.total_price_usd),
        weightKg: numeric(row.weight_kg),
        quantity: numeric(row.quantity),
      } as NormalizedPurchaseRow;
    })
    .filter((row): row is NormalizedPurchaseRow => Boolean(row));

  const normalizedPurchases =
    normalizedPurchasesFromTrend.length > 0
      ? normalizedPurchasesFromTrend
      : companies.map((companyRecord) => {
          const companyTableRow = companiesTableByCompanyId.get(companyRecord.id);
          const overview = overviewByCompanyId.get(companyRecord.id);
          const fallbackDate =
            normalizeDate(companyTableRow?.latest_purchase_time) ||
            normalizeDate(overview?.latest_purchase_date) ||
            normalizeDate(companyTableRow?.created_at) ||
            normalizeDate(overview?.updated_at) ||
            new Date().toISOString().slice(0, 10);

          const hsCode =
            hsCodeFromText(
              companyTableRow?.product,
              companyTableRow?.product_description,
              overview?.core_products?.[0],
            ) || FALLBACK_HS_CODE;

          const product =
            pickFirstText(
              companyTableRow?.product,
              overview?.core_products?.[0],
              FALLBACK_PRODUCT_NAME,
            ) ?? FALLBACK_PRODUCT_NAME;

          const productDescription = pickFirstText(
            companyTableRow?.product_description,
            overview?.business_overview,
            product,
          );

          const weightKg =
            numeric(companyTableRow?.trades) ||
            numeric(overview?.purchase_frequency_per_year) ||
            0;

          return {
            companyId: companyRecord.id,
            date: fallbackDate,
            month: fallbackDate.slice(0, 7),
            hsCode,
            hsCodeFamily: hsFamily(hsCode),
            product,
            productDescription,
            importer: companyRecord.company.name,
            exporter: overview?.core_suppliers?.[0] ?? undefined,
            originCountry: overview?.core_supplier_countries?.[0] ?? undefined,
            destinationCountry: companyRecord.countryName ?? undefined,
            totalPriceUsd:
              numeric(overview?.purchase_value_last_12m) ||
              numeric(overview?.total_purchase_value),
            weightKg,
            quantity: weightKg,
          } as NormalizedPurchaseRow;
        });

  return {
    companies,
    purchases: normalizedPurchases,
    countryNameByCode,
  } as CompanyListDataset;
};

export const getCompanyByIdFromDataset = (dataset: CompanyListDataset, companyId: string) =>
  dataset.companies.find((item) => item.id === companyId)?.company;

export const getCountryNameByCodeFromDataset = (dataset: CompanyListDataset, countryCode: string) => {
  if (!countryCode) return "";
  return dataset.countryNameByCode[countryCode] ?? countryNameFromCode(countryCode) ?? countryCode;
};

export const getHsCodesFromDataset = (dataset: CompanyListDataset): HsCode[] => {
  const grouped = new Map<
    string,
    {
      productCounts: Map<string, number>;
      descriptionCounts: Map<string, number>;
    }
  >();

  dataset.purchases.forEach((row) => {
    const family = row.hsCodeFamily || hsFamily(row.hsCode);
    if (!family) return;
    const entry = grouped.get(family) ?? {
      productCounts: new Map<string, number>(),
      descriptionCounts: new Map<string, number>(),
    };

    const product = row.product?.trim();
    if (product) {
      entry.productCounts.set(product, (entry.productCounts.get(product) ?? 0) + 1);
    }

    const description = row.productDescription?.trim();
    if (description) {
      entry.descriptionCounts.set(description, (entry.descriptionCounts.get(description) ?? 0) + 1);
    }

    grouped.set(family, entry);
  });

  const pickMostFrequent = (counter: Map<string, number>) =>
    Array.from(counter.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  return Array.from(grouped.entries())
    .map(([code, entry]) => {
      const chapter = code.slice(0, 2);
      const product = pickMostFrequent(entry.productCounts) ?? `HS ${code}`;
      const description = pickMostFrequent(entry.descriptionCounts) ?? product;
      return {
        code,
        product,
        description,
        category: chapter ? `HS ${chapter}` : "Trade",
        chapter,
      } as HsCode;
    })
    .sort((a, b) => a.code.localeCompare(b.code));
};

export const getAvailableMonthsFromDataset = (dataset: CompanyListDataset, hsCode: string) => {
  const months = new Set(
    dataset.purchases
      .filter((row) => isSameHsFamily(row.hsCode, hsCode))
      .map((row) => row.month),
  );
  return Array.from(months).sort();
};

export const getCompanySummariesFromDataset = (params: {
  dataset: CompanyListDataset;
  hsCode: string;
  startMonth: string;
  endMonth: string;
}) => {
  const { dataset, hsCode, startMonth, endMonth } = params;
  const companyMetaById = new Map(dataset.companies.map((company) => [company.id, company]));
  const hsMonths = getAvailableMonthsFromDataset(dataset, hsCode);
  const inRangeRows = dataset.purchases.filter(
    (row) => isSameHsFamily(row.hsCode, hsCode) && inMonthRange(row.month, startMonth, endMonth),
  );

  const grouped = new Map<string, NormalizedPurchaseRow[]>();
  inRangeRows.forEach((row) => {
    const list = grouped.get(row.companyId) ?? [];
    list.push(row);
    grouped.set(row.companyId, list);
  });

  const summaries = Array.from(grouped.entries()).map(([companyId, rows]) => {
    const meta = companyMetaById.get(companyId);
    const metricTotal = rows.reduce((sum, row) => sum + row.weightKg, 0);
    const tradeSum = rows.reduce((sum, row) => sum + (row.quantity || row.weightKg), 0);
    const shipmentsCount = rows.length;
    const frequency = new Set(rows.map((row) => row.month)).size;
    const lastActiveDate = rows.reduce((latest, row) => (row.date > latest ? row.date : latest), "");
    const product = modeBy(rows, (row) => row.product?.trim());
    const productDescription = modeBy(rows, (row) => row.productDescription?.trim());

    const monthlyTotals = new Map<string, number>();
    dataset.purchases.forEach((row) => {
      if (row.companyId !== companyId || !isSameHsFamily(row.hsCode, hsCode)) return;
      monthlyTotals.set(row.month, (monthlyTotals.get(row.month) ?? 0) + row.weightKg);
    });
    const trend = computeTrend(hsMonths, monthlyTotals, endMonth);

    return {
      id: companyId,
      name: meta?.company.name ?? companyId,
      countryCode: meta?.company.countryCode ?? "",
      buyerType: meta?.company.buyerType,
      industry: meta?.company.industry,
      website: meta?.company.website,
      metricTotal,
      shipmentsCount,
      frequency,
      trend: trend.trend,
      changePct: trend.changePct,
      lastActiveDate: lastActiveDate || undefined,
      status: meta?.status ?? "existing",
      tradeSum,
      product: product ?? meta?.overview?.core_products?.[0] ?? undefined,
      productDescription: productDescription ?? meta?.overview?.business_overview ?? undefined,
    } as CompanyListSummary;
  });

  return summaries;
};

export const getCompanyTradeHistoryFromDataset = (params: {
  dataset: CompanyListDataset;
  companyId: string;
  hsCode: string;
  startMonth: string;
  endMonth: string;
}) => {
  const { dataset, companyId, hsCode, startMonth, endMonth } = params;
  const rows = dataset.purchases.filter(
    (row) =>
      row.companyId === companyId &&
      isSameHsFamily(row.hsCode, hsCode) &&
      inMonthRange(row.month, startMonth, endMonth),
  );

  const grouped = new Map<string, TradeHistoryRow>();
  rows.forEach((row) => {
    const current = grouped.get(row.month) ?? {
      month: row.month,
      originCountry: row.originCountry,
      counterparty: row.exporter,
      weightKg: 0,
      shipmentsCount: 0,
      valueUsd: 0,
    };

    current.weightKg += row.weightKg;
    current.shipmentsCount = (current.shipmentsCount ?? 0) + 1;
    current.valueUsd = (current.valueUsd ?? 0) + row.totalPriceUsd;

    if (current.originCountry && row.originCountry && current.originCountry !== row.originCountry) {
      current.originCountry = "Multiple";
    }
    if (current.counterparty && row.exporter && current.counterparty !== row.exporter) {
      current.counterparty = "Multiple";
    }

    grouped.set(row.month, current);
  });

  return Array.from(grouped.values()).sort((a, b) => (a.month > b.month ? -1 : 1));
};
