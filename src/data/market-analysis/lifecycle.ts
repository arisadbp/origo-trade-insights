import * as XLSX from "xlsx";

export type PhaseKey = "growth" | "maturity" | "adjustment";

export interface TrendPoint {
  period: string;
  value: number;
}

export interface PhaseCountry {
  countryName: string;
  countryCode: string | null;
  quarterlyCAGR: number | null;
  cagrPercent: number | null;
  trendSeries: TrendPoint[];
}

export interface PhaseGroup {
  phaseKey: PhaseKey;
  phaseLabel: string;
  countriesCount: number;
  countries: PhaseCountry[];
  noData?: boolean;
}

export interface LifecycleDatasetInfo {
  name: string;
  sourceFile: string;
  sheet: string;
  metric: string;
  periodType: "quarter";
  notes: {
    growthDefinition: string;
    maturityDefinition: string;
    adjustmentDefinition: string;
  };
}

export interface OtherCountries {
  count: number;
  countryNames: string[];
}

export interface MarketAnalysisSnapshot {
  dataset: LifecycleDatasetInfo;
  phases: PhaseGroup[];
  otherCountries: OtherCountries;
  interpretation: string;
  currentPhase: PhaseKey;
  demandDirection: "Increasing" | "Stable" | "Declining" | "Not available";
  stability: "Low" | "Medium" | "High" | "Not available";
}

const phaseLabelMap: Record<PhaseKey, string> = {
  growth: "Growth Phase",
  maturity: "Maturity Phase",
  adjustment: "Adjustment Phase",
};

const datasetInfo: LifecycleDatasetInfo = {
  name: "Sugar - Product Market Lifecycle",
  sourceFile: "Sugar-Product Market Lifecycle.xlsx",
  sheet: "Sheet1",
  metric: "trade_value_or_volume",
  periodType: "quarter",
  notes: {
    growthDefinition:
      "The target product's trade value/volume quarterly CAGR is high over the past three years",
    maturityDefinition:
      "The target product's trade value/volume quarterly CAGR has been stable over the past three years",
    adjustmentDefinition:
      "The target product's trade value/volume quarterly CAGR is low over the past three years",
  },
};

const fallbackOtherCountryNames = [
  "South Sudan",
  "Democratic Republic of the Congo",
  "Malaysia",
  "Indonesia",
  "South Korea",
  "Guatemala",
  "Ghana",
  "Pakistan",
  "Tanzania",
  "Taiwan, China",
  "Canada",
  "Kenya",
  "Bulgaria",
  "China",
];

const emptyPhaseMap = (): Record<PhaseKey, PhaseGroup> => ({
  growth: {
    phaseKey: "growth",
    phaseLabel: phaseLabelMap.growth,
    countriesCount: 0,
    countries: [],
  },
  maturity: {
    phaseKey: "maturity",
    phaseLabel: phaseLabelMap.maturity,
    countriesCount: 0,
    countries: [],
  },
  adjustment: {
    phaseKey: "adjustment",
    phaseLabel: phaseLabelMap.adjustment,
    countriesCount: 0,
    countries: [],
  },
});

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = normalizeText(value).replace(/,/g, "");
  if (!normalized || normalized === "-" || normalized === "—") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parsePhaseFromHeading = (text: string): PhaseKey | null => {
  if (/growth phase/i.test(text)) return "growth";
  if (/maturity phase/i.test(text)) return "maturity";
  if (/adjustment phase/i.test(text) || /decline phase/i.test(text)) return "adjustment";
  return null;
};

const periodSortValue = (period: string) => {
  const match = period.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 10 + Number(match[2]);
};

const parseOtherCountries = (raw: string, count: number) => {
  const source = normalizeText(raw);
  if (!source) return fallbackOtherCountryNames.slice(0, count);

  const candidates = [...fallbackOtherCountryNames].sort((a, b) => b.length - a.length);
  const names: string[] = [];
  let remaining = source;

  while (remaining.length) {
    let found: string | null = null;
    for (const candidate of candidates) {
      if (remaining.startsWith(candidate)) {
        found = candidate;
        break;
      }
    }

    if (found) {
      names.push(found);
      remaining = remaining.slice(found.length).trimStart();
    } else {
      const nextSpace = remaining.indexOf(" ");
      if (nextSpace < 0) break;
      remaining = remaining.slice(nextSpace + 1).trimStart();
    }
  }

  if (!names.length || names.length < Math.min(count, 5)) {
    return fallbackOtherCountryNames.slice(0, count || fallbackOtherCountryNames.length);
  }

  return names.slice(0, count);
};

const inferCurrentPhase = (phases: PhaseGroup[]): PhaseKey => {
  const allCagr = phases
    .flatMap((phase) => phase.countries)
    .map((country) => country.quarterlyCAGR)
    .filter((value): value is number => value !== null);

  if (!allCagr.length) return "maturity";
  const mean = allCagr.reduce((sum, value) => sum + value, 0) / allCagr.length;
  if (mean > 0.05) return "growth";
  if (mean < -0.05) return "adjustment";
  return "maturity";
};

const inferDemandDirection = (
  phases: PhaseGroup[],
): "Increasing" | "Stable" | "Declining" | "Not available" => {
  const points = phases
    .flatMap((phase) => phase.countries)
    .flatMap((country) => country.trendSeries);

  if (!points.length) return "Not available";

  const byPeriod = new Map<string, number>();
  points.forEach((point) => {
    byPeriod.set(point.period, (byPeriod.get(point.period) ?? 0) + point.value);
  });

  const ordered = Array.from(byPeriod.entries())
    .sort(([left], [right]) => periodSortValue(left) - periodSortValue(right))
    .map(([, value]) => value);

  if (ordered.length < 2 || ordered[0] <= 0) return "Not available";
  const change = (ordered[ordered.length - 1] - ordered[0]) / ordered[0];
  if (change > 0.08) return "Increasing";
  if (change < -0.08) return "Declining";
  return "Stable";
};

const inferStability = (phases: PhaseGroup[]): "Low" | "Medium" | "High" | "Not available" => {
  const cagrValues = phases
    .flatMap((phase) => phase.countries)
    .map((country) => country.quarterlyCAGR)
    .filter((value): value is number => value !== null);

  if (cagrValues.length < 2) return "Not available";
  const mean = cagrValues.reduce((sum, value) => sum + value, 0) / cagrValues.length;
  const variance = cagrValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / cagrValues.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev >= 0.5) return "High";
  if (stdDev >= 0.2) return "Medium";
  return "Low";
};

export const parseLifecycleWorkbookRows = (rows: unknown[][]): MarketAnalysisSnapshot => {
  const phaseMap = emptyPhaseMap();
  let activePhase: PhaseKey | null = null;
  let interpretation = "";
  let otherCountries: OtherCountries = { count: 0, countryNames: [] };

  let index = 0;
  while (index < rows.length) {
    const row = rows[index] ?? [];
    const firstCell = normalizeText(row[0]);
    const secondCell = normalizeText(row[1]);

    if (!interpretation && /data interpretation/i.test(firstCell)) {
      interpretation = firstCell.replace(/^Data Interpretation:\s*/i, "").trim();
    }

    if (/^Other countries/i.test(firstCell)) {
      const countMatch = firstCell.match(/(\d+)/);
      const count = countMatch ? Number(countMatch[1]) : fallbackOtherCountryNames.length;
      otherCountries = {
        count,
        countryNames: parseOtherCountries(secondCell, count),
      };
      index += 1;
      continue;
    }

    const phaseKey = parsePhaseFromHeading(firstCell);
    if (phaseKey) {
      activePhase = phaseKey;
      const countMatch = firstCell.match(/(\d+)/);
      if (countMatch) phaseMap[phaseKey].countriesCount = Number(countMatch[1]);
      index += 1;
      continue;
    }

    const countryMatch = secondCell.match(/^(.+?)-[A-Za-z0-9 ]*Lifecycle$/i);
    if (countryMatch) {
      const countryName = countryMatch[1].trim();
      const phase = activePhase ?? "maturity";

      const headerRow = rows[index + 1] ?? [];
      const cagrColIndex = headerRow.findIndex((cell) => /cagr/i.test(normalizeText(cell)));
      const yearColumns: Array<{ year: string; index: number }> = [];

      headerRow.forEach((cell, colIndex) => {
        const label = normalizeText(cell);
        if (/^\d{4}$/.test(label)) {
          yearColumns.push({ year: label, index: colIndex });
        }
      });

      let quarterlyCAGR: number | null = null;
      const trendSeries: TrendPoint[] = [];

      let cursor = index + 2;
      while (cursor < rows.length) {
        const scanRow = rows[cursor] ?? [];
        const scanFirst = normalizeText(scanRow[0]);
        const scanSecond = normalizeText(scanRow[1]);

        if (parsePhaseFromHeading(scanFirst)) break;
        if (scanSecond.match(/^(.+?)-[A-Za-z0-9 ]*Lifecycle$/i)) break;

        const quarterMatch = scanSecond.match(/^Q([1-4])$/i);
        if (quarterMatch) {
          const quarter = `Q${quarterMatch[1]}`;
          if (quarterlyCAGR === null && cagrColIndex >= 0) {
            const cagrValue = toNumeric(scanRow[cagrColIndex]);
            if (cagrValue !== null) quarterlyCAGR = cagrValue;
          }
          yearColumns.forEach(({ year, index: yearColIndex }) => {
            const numeric = toNumeric(scanRow[yearColIndex]);
            if (numeric !== null) {
              trendSeries.push({ period: `${year}-${quarter}`, value: numeric });
            }
          });
        }

        if (/^Total$/i.test(scanSecond)) break;
        cursor += 1;
      }

      phaseMap[phase].countries.push({
        countryName,
        countryCode: null,
        quarterlyCAGR,
        cagrPercent: quarterlyCAGR === null ? null : Number((quarterlyCAGR * 100).toFixed(2)),
        trendSeries,
      });

      index = cursor;
      continue;
    }

    index += 1;
  }

  const phases: PhaseGroup[] = (["growth", "maturity", "adjustment"] as PhaseKey[]).map((key) => {
    const phase = phaseMap[key];
    const countriesCount = phase.countriesCount > 0 ? phase.countriesCount : phase.countries.length;
    return {
      ...phase,
      countriesCount,
      noData: phase.countries.length === 0,
    };
  });

  const currentPhase = inferCurrentPhase(phases);
  const demandDirection = inferDemandDirection(phases);
  const stability = inferStability(phases);

  return {
    dataset: datasetInfo,
    phases,
    otherCountries,
    interpretation:
      interpretation ||
      "Demand conditions are mixed across countries. Focus on growth markets while protecting margin in adjustment markets.",
    currentPhase,
    demandDirection,
    stability,
  };
};

export const parseLifecycleWorkbook = (arrayBuffer: ArrayBuffer): MarketAnalysisSnapshot => {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[datasetInfo.sheet];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  return parseLifecycleWorkbookRows(rows);
};

export const loadMarketAnalysisSnapshot = async (
  workbookUrl = "/market-analysis-lifecycle.xlsx",
): Promise<MarketAnalysisSnapshot> => {
  const response = await fetch(workbookUrl);
  if (!response.ok) {
    throw new Error(`Unable to load lifecycle workbook (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  return parseLifecycleWorkbook(buffer);
};
