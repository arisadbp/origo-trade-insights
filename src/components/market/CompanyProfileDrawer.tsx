import { useEffect, useMemo, useState } from "react";
import { Copy, Check, Download, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Company, Country, HsCode } from "@/data/market-intelligence/types";
import type { TradeHistoryRow } from "@/data/market-intelligence/selectors";
import { formatMonthLabel } from "@/data/market-intelligence/selectors";
import { getFlagEmoji } from "@/lib/flags";

interface CompanyProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
  country?: Country;
  hsCode?: HsCode;
  dateRangeLabel: string;
  tradeHistory: TradeHistoryRow[];
  tradeHistoryUsedFallback?: boolean;
  isLoading?: boolean;
}

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const CopyButton = ({ value }: { value?: string }) => {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className="h-7 w-7"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
};

const InfoRow = ({ label, value, href }: { label: string; value?: string; href?: string }) => {
  if (!value) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm">—</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex max-w-[72%] items-center gap-2">
        {href ? (
          <a
            href={href}
            className="truncate text-sm text-primary hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {value}
          </a>
        ) : (
          <span className="truncate text-sm">{value}</span>
        )}
        <CopyButton value={value} />
      </div>
    </div>
  );
};

const exportCsv = (rows: TradeHistoryRow[], fileName: string) => {
  const headers = [
    "Month",
    "Origin Country",
    "Counterparty",
    "Weight (KG)",
    "Value (USD)",
    "Shipments",
  ];

  const escape = (value: string | number | undefined) => {
    if (value === undefined || value === null) return "";
    const stringValue = String(value).replace(/"/g, '""');
    return `"${stringValue}"`;
  };

  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.month,
        row.originCountry ?? "",
        row.counterparty ?? "",
        row.weightKg,
        row.valueUsd ?? "",
        row.shipmentsCount ?? "",
      ]
        .map(escape)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function CompanyProfileDrawer({
  open,
  onOpenChange,
  company,
  country,
  hsCode,
  dateRangeLabel,
  tradeHistory,
  tradeHistoryUsedFallback = false,
  isLoading,
}: CompanyProfileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  const hasHistory = tradeHistory.length > 0;
  const hasCompanyProfile = Boolean(company);
  const countryDisplay = country
    ? `${getFlagEmoji(country.code)} ${country.name} (${country.code})`
    : undefined;
  const hasContactInfo = Boolean(
    company?.contacts?.person ||
      company?.contacts?.email ||
      company?.contacts?.phone ||
      company?.contacts?.website ||
      company?.contacts?.linkedIn,
  );
  const historyRows = useMemo(
    () => [...tradeHistory].sort((a, b) => (a.month > b.month ? -1 : 1)),
    [tradeHistory],
  );

  const handleExport = () => {
    if (!company) return;
    exportCsv(historyRows, `trade-history-${company.id}.csv`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close profile"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Company profile"
        className="absolute inset-x-0 bottom-0 mx-auto flex h-[92vh] w-full flex-col rounded-t-2xl border bg-background shadow-2xl md:bottom-5 md:h-[88vh] md:max-w-5xl md:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 pb-4 pt-5 text-left">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold leading-tight">
                {company?.name ?? "Company Profile"}
              </h2>
              {company?.buyerType && <Badge variant="secondary">{company.buyerType}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {hsCode ? `${hsCode.product} · ${hsCode.description} (${hsCode.code})` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Close profile"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-6 pb-8 pt-5">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-8">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Company Identity
                </h3>
                <div className="grid gap-3 rounded-lg border bg-card p-4">
                  {!hasCompanyProfile && (
                    <p className="text-sm text-muted-foreground">
                      No profile data for this company yet.
                    </p>
                  )}
                  <InfoRow label="Company name" value={company?.name} />
                  <InfoRow label="Country" value={countryDisplay} />
                  <InfoRow label="Industry" value={company?.industry} />
                  <InfoRow label="Buyer type" value={company?.buyerType} />
                  <InfoRow label="Website" value={company?.website} href={company?.website} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Contact Information
                </h3>
                <div className="grid gap-3 rounded-lg border bg-card p-4">
                  {!hasContactInfo && (
                    <p className="text-sm text-muted-foreground">
                      No contact details available in the current dataset.
                    </p>
                  )}
                  <InfoRow label="Contact" value={company?.contacts?.person} />
                  <InfoRow
                    label="Email"
                    value={company?.contacts?.email}
                    href={company?.contacts?.email ? `mailto:${company.contacts.email}` : undefined}
                  />
                  <InfoRow
                    label="Phone"
                    value={company?.contacts?.phone}
                    href={company?.contacts?.phone ? `tel:${company.contacts.phone}` : undefined}
                  />
                  <InfoRow
                    label="Website"
                    value={company?.contacts?.website ?? company?.website}
                    href={company?.contacts?.website ?? company?.website}
                  />
                  <InfoRow
                    label="LinkedIn"
                    value={company?.contacts?.linkedIn}
                    href={company?.contacts?.linkedIn}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Trade History
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Date range: {dateRangeLabel}
                    </p>
                    {tradeHistoryUsedFallback && (
                      <p className="text-xs text-muted-foreground">
                        No records in the selected range. Showing latest available history.
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        HS: {hsCode?.code ?? "Not available"}
                      </Badge>
                      <Badge variant="outline" className="font-normal">
                        Date range: {dateRangeLabel || "Not available"}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExport} disabled={!hasHistory}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>

                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date (Month)</TableHead>
                        <TableHead>Origin Country</TableHead>
                        <TableHead>Exporter / Counterparty</TableHead>
                        <TableHead className="text-right">Weight (KG)</TableHead>
                        <TableHead className="text-right">Value (USD)</TableHead>
                        <TableHead className="text-right">Shipment Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            No data for this selection.
                          </TableCell>
                        </TableRow>
                      ) : (
                        historyRows.map((row) => (
                          <TableRow key={`${row.month}-${row.originCountry ?? "na"}`}>
                            <TableCell className="font-medium">{formatMonthLabel(row.month)}</TableCell>
                            <TableCell>{row.originCountry ?? "—"}</TableCell>
                            <TableCell>{row.counterparty ?? "—"}</TableCell>
                            <TableCell className="text-right">{formatNumber(row.weightKg)}</TableCell>
                            <TableCell className="text-right">
                              {row.valueUsd ? formatNumber(row.valueUsd) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.shipmentsCount ? formatNumber(row.shipmentsCount) : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
