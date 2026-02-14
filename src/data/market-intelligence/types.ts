export type BuyerType = "Importer" | "Distributor" | "Trader";

export type HsCode = {
  code: string;
  product: string;
  description: string;
  category: string;
  chapter: string;
};

export type Country = {
  code: string;
  name: string;
};

export type CountryMetric = {
  hsCode: string;
  month: string; // YYYY-MM
  countryCode: string;
  weightKg: number;
  valueUsd?: number;
  importersCount: number;
  share: number;
};

export type CompanyContact = {
  person?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedIn?: string;
};

export type Company = {
  id: string;
  name: string;
  countryCode: string;
  buyerType?: BuyerType;
  industry?: string;
  website?: string;
  contacts?: CompanyContact;
};

export type CompanyCountryHsMetric = {
  companyId: string;
  hsCode: string;
  month: string; // YYYY-MM
  weightKg: number;
  shipmentsCount?: number;
  valueUsd?: number;
  lastActiveDate?: string; // YYYY-MM-DD
};

export type CompanyTradeRow = {
  companyId: string;
  hsCode: string;
  date: string; // YYYY-MM-DD
  originCountry?: string;
  counterparty?: string;
  weightKg: number;
  shipmentsCount?: number;
  valueUsd?: number;
};

export type TradeHistoryRow = {
  month: string;
  originCountry?: string;
  counterparty?: string;
  weightKg: number;
  shipmentsCount?: number;
  valueUsd?: number;
};

export type MetricKey = "weightKg" | "valueUsd";

export type TrendDirection = "up" | "down" | "neutral";
