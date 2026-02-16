import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  createMarketRecord,
  changeCustomerEmail,
  deleteMarketRecord,
  getMarketSourceStatus,
  createPreset,
  createUpload,
  deleteUpload,
  getCustomerBundle,
  listAuditLogs,
  listInventory,
  listInvoices,
  listMarketRecords,
  listPresets,
  listSessions,
  listUploads,
  reviewUpload,
  searchCustomerContexts,
  signOutAllSessions,
  triggerPasswordReset,
  updateCompanyProfile,
  updateMarketRecord,
  setMarketSourceLink,
  buildAdminApiUrl,
  type CustomerContextRow,
} from "@/lib/adminApi";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Bundle = Awaited<ReturnType<typeof getCustomerBundle>>;

const REVIEW_BADGE_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  CHANGES_REQUESTED: "bg-blue-100 text-blue-700",
};

export default function AdminBackoffice() {
  const { toast } = useToast();
  const [search, setSearch] = useState("info@farihealth.com");
  const [contexts, setContexts] = useState<CustomerContextRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CustomerContextRow | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [uploads, setUploads] = useState<Awaited<ReturnType<typeof listUploads>>>([]);
  const [marketRows, setMarketRows] = useState<Awaited<ReturnType<typeof listMarketRecords>>>([]);
  const [inventoryRows, setInventoryRows] = useState<Awaited<ReturnType<typeof listInventory>>>([]);
  const [invoiceRows, setInvoiceRows] = useState<Awaited<ReturnType<typeof listInvoices>>>([]);
  const [sessionRows, setSessionRows] = useState<Awaited<ReturnType<typeof listSessions>>>([]);
  const [auditRows, setAuditRows] = useState<Awaited<ReturnType<typeof listAuditLogs>>>([]);
  const [presetRows, setPresetRows] = useState<Awaited<ReturnType<typeof listPresets>>>([]);
  const [marketSourceStatus, setMarketSourceStatus] = useState<Awaited<ReturnType<typeof getMarketSourceStatus>>>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [marketFilters, setMarketFilters] = useState({
    market: "",
    productType: "",
    dateFrom: "",
    dateTo: "",
  });
  const [profileForm, setProfileForm] = useState({
    company_name: "",
    contact_name: "",
    phone: "",
    country: "",
    notes: "",
  });
  const [emailForm, setEmailForm] = useState({
    newEmail: "",
    reason: "Requested by customer",
    forceSignOutAllSessions: false,
  });
  const [uploadForm, setUploadForm] = useState({
    file_name: "",
    file_type: "",
    description: "",
    file: null as File | null,
  });
  const [marketLinkCompanyId, setMarketLinkCompanyId] = useState("");
  const [marketRecordForm, setMarketRecordForm] = useState({
    market: "",
    product_type: "",
    metric_date: "",
    value: "",
  });

  const selectedCustomerId = selected?.customer_id || "";

  async function refreshSearch(query: string) {
    try {
      setLoading(true);
      const rows = await searchCustomerContexts(query);
      setContexts(rows);
      setApiError(null);
      if (!selected && rows.length > 0) {
        setSelected(rows[0]);
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to search customer contexts");
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Unable to search customer contexts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function refreshData(customerId: string) {
    if (!customerId) return;
    try {
      setLoading(true);
      const [bundleData, uploadsData, marketData, inventoryData, invoiceData, sessionsData, auditData, presetsData, marketSource] =
        await Promise.all([
          getCustomerBundle(customerId),
          listUploads(customerId),
          listMarketRecords(customerId, marketFilters),
          listInventory(customerId),
          listInvoices(customerId),
          listSessions(customerId),
          listAuditLogs(customerId),
          listPresets(customerId),
          getMarketSourceStatus(customerId),
        ]);
      setBundle(bundleData);
      setApiError(null);
      setProfileForm({
        company_name: bundleData.customer.company_name,
        contact_name: bundleData.customer.contact_name,
        phone: bundleData.customer.phone,
        country: bundleData.customer.country,
        notes: bundleData.customer.notes,
      });
      setEmailForm((current) => ({
        ...current,
        newEmail: bundleData.account.email,
      }));
      setUploads(uploadsData);
      setMarketRows(marketData);
      setInventoryRows(inventoryData);
      setInvoiceRows(invoiceData);
      setSessionRows(sessionsData);
      setAuditRows(auditData);
      setPresetRows(presetsData);
      setMarketSourceStatus(marketSource);
      setMarketLinkCompanyId(marketSource?.company_id || "");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to load customer data");
      toast({
        title: "Load failed",
        description: error instanceof Error ? error.message : "Unable to load customer data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshSearch(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      void refreshData(selectedCustomerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId]);

  const marketChartData = useMemo(() => (
    marketRows.map((row) => ({
      date: row.metric_date,
      value: row.value,
    }))
  ), [marketRows]);

  const contextBar = selected && bundle ? (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <span className="font-medium">{bundle.customer.company_name}</span>
        <span className="text-muted-foreground"> | {bundle.account.email} ({bundle.account.username})</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{bundle.account.role}</Badge>
        <Badge variant="secondary">Uploads: {bundle.stats.total_uploads}</Badge>
        <Badge variant="secondary">Pending: {bundle.stats.pending_uploads}</Badge>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <TopBar
        title="Admin Backoffice"
        subtitle="Multi-customer operations with context switcher"
        contextBar={contextBar}
      />
      <div className="space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Context Switcher</CardTitle>
            <CardDescription>Search by company, email, or username</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="info@farihealth.com, trrgroup, THAI ROONG RUANG..."
              />
              <Button onClick={() => void refreshSearch(search)} disabled={loading}>
                Search
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {contexts.map((context) => (
                <button
                  key={context.customer_id}
                  type="button"
                  className={`rounded border p-3 text-left transition ${
                    selectedCustomerId === context.customer_id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onClick={() => setSelected(context)}
                >
                  <p className="font-medium">{context.company_name}</p>
                  <p className="text-xs text-muted-foreground">{context.email} ({context.username})</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {apiError ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="py-3 text-sm text-destructive">
              API connection issue: {apiError}. Start backend API with `npm run api:dev` or `npm run dev:full`.
            </CardContent>
          </Card>
        ) : null}

        {!selected || !bundle ? null : (
          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap gap-2">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="company">My Company</TabsTrigger>
              <TabsTrigger value="uploads">Upload Center</TabsTrigger>
              <TabsTrigger value="market">Market Intelligence</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="invoices">Invoices & Payments</TabsTrigger>
              <TabsTrigger value="security">Profile & Security</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <Card>
                <CardHeader>
                  <CardTitle>Dashboard</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Card>
                      <CardContent className="py-4">
                        <p className="text-sm text-muted-foreground">Total uploads</p>
                        <p className="text-2xl font-semibold">{bundle.stats.total_uploads}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4">
                        <p className="text-sm text-muted-foreground">Pending review</p>
                        <p className="text-2xl font-semibold">{bundle.stats.pending_uploads}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4">
                        <p className="text-sm text-muted-foreground">Approved</p>
                        <p className="text-2xl font-semibold">{bundle.stats.approved_uploads}</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bundle.recentActivity.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.action}</TableCell>
                          <TableCell>{item.actor_email}</TableCell>
                          <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="company">
              <Card>
                <CardHeader>
                  <CardTitle>Company Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Company Name</Label>
                      <Input
                        value={profileForm.company_name}
                        onChange={(event) => setProfileForm({ ...profileForm, company_name: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Contact Name</Label>
                      <Input
                        value={profileForm.contact_name}
                        onChange={(event) => setProfileForm({ ...profileForm, contact_name: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input
                        value={profileForm.phone}
                        onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Country</Label>
                      <Input
                        value={profileForm.country}
                        onChange={(event) => setProfileForm({ ...profileForm, country: event.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Textarea
                      value={profileForm.notes}
                      onChange={(event) => setProfileForm({ ...profileForm, notes: event.target.value })}
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      await updateCompanyProfile(selectedCustomerId, profileForm);
                      await refreshData(selectedCustomerId);
                      toast({ title: "Company profile updated" });
                    }}
                  >
                    Save Profile
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="uploads">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Center</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-2 rounded border p-3 md:flex-row">
                    <Input
                      placeholder="file_name"
                      value={uploadForm.file_name}
                      onChange={(event) => setUploadForm({ ...uploadForm, file_name: event.target.value })}
                    />
                    <Input
                      placeholder="file_type (csv/xlsx/pdf)"
                      value={uploadForm.file_type}
                      onChange={(event) => setUploadForm({ ...uploadForm, file_type: event.target.value })}
                    />
                    <Input
                      placeholder="description"
                      value={uploadForm.description}
                      onChange={(event) => setUploadForm({ ...uploadForm, description: event.target.value })}
                    />
                    <Input
                      type="file"
                      onChange={(event) => {
                        setUploadForm({
                          ...uploadForm,
                          file: event.target.files?.[0] || null,
                        });
                      }}
                    />
                    <Button
                      onClick={async () => {
                        await createUpload(selectedCustomerId, {
                          file_name: uploadForm.file_name,
                          file_type: uploadForm.file_type,
                          description: uploadForm.description,
                          uploaded_by: bundle.account.email,
                          file: uploadForm.file,
                        });
                        setUploadForm({ file_name: "", file_type: "", description: "", file: null });
                        await refreshData(selectedCustomerId);
                        toast({ title: "Upload created" });
                      }}
                    >
                      Upload
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewer</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploads.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p>{item.file_name}</p>
                            <p className="text-xs text-muted-foreground">{item.file_type}</p>
                          </TableCell>
                          <TableCell>
                            <Badge className={REVIEW_BADGE_CLASS[item.review_status]}>
                              {item.review_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.reviewer_name || "-"}</TableCell>
                          <TableCell className="space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await reviewUpload(selectedCustomerId, item.id, {
                                  review_status: "APPROVED",
                                  comment: "Approved by ORIGO reviewer",
                                  reason: "Review completed",
                                });
                                await refreshData(selectedCustomerId);
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await reviewUpload(selectedCustomerId, item.id, {
                                  review_status: "CHANGES_REQUESTED",
                                  comment: "Please update metadata",
                                  reason: "Data quality issue",
                                });
                                await refreshData(selectedCustomerId);
                              }}
                            >
                              Request Changes
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                await deleteUpload(selectedCustomerId, item.id, "Admin cleanup");
                                await refreshData(selectedCustomerId);
                              }}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="market">
              <Card>
                <CardHeader>
                  <CardTitle>Market Intelligence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 rounded border p-3 md:grid-cols-4">
                    <div className="md:col-span-3">
                      <Label className="mb-1 block">Linked Supabase `company_id`</Label>
                      <Input
                        placeholder="e.g. trrgroup_company_id"
                        value={marketLinkCompanyId}
                        onChange={(event) => setMarketLinkCompanyId(event.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="w-full"
                        onClick={async () => {
                          await setMarketSourceLink(selectedCustomerId, marketLinkCompanyId);
                          await refreshData(selectedCustomerId);
                          toast({ title: "Market company link updated" });
                        }}
                      >
                        Link Company
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground md:col-span-4">
                      Current link: {marketSourceStatus?.company_id || "not linked"} ({marketSourceStatus?.source || "none"})
                    </p>
                  </div>

                  <div className="grid gap-2 md:grid-cols-5">
                    <Input
                      placeholder="Market"
                      value={marketFilters.market}
                      onChange={(event) => setMarketFilters({ ...marketFilters, market: event.target.value })}
                    />
                    <Input
                      placeholder="Product Type"
                      value={marketFilters.productType}
                      onChange={(event) => setMarketFilters({ ...marketFilters, productType: event.target.value })}
                    />
                    <Input
                      type="date"
                      value={marketFilters.dateFrom}
                      onChange={(event) => setMarketFilters({ ...marketFilters, dateFrom: event.target.value })}
                    />
                    <Input
                      type="date"
                      value={marketFilters.dateTo}
                      onChange={(event) => setMarketFilters({ ...marketFilters, dateTo: event.target.value })}
                    />
                    <Button
                      onClick={async () => {
                        const rows = await listMarketRecords(selectedCustomerId, marketFilters);
                        setMarketRows(rows);
                      }}
                    >
                      Apply Filters
                    </Button>
                  </div>
                  <div className="h-64 w-full rounded border p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={marketChartData}>
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#D97706" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await createPreset(selectedCustomerId, {
                          name: "Saved from admin UI",
                          filters: marketFilters,
                        });
                        await refreshData(selectedCustomerId);
                      }}
                    >
                      Save Preset
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open(
                          buildAdminApiUrl(`/customers/${selectedCustomerId}/market-intelligence/export.csv`),
                          "_blank",
                        );
                      }}
                    >
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open(
                          buildAdminApiUrl(`/customers/${selectedCustomerId}/market-intelligence/export.pdf`),
                          "_blank",
                        );
                      }}
                    >
                      Export PDF
                    </Button>
                  </div>

                  <div className="grid gap-2 rounded border p-3 md:grid-cols-5">
                    <Input
                      placeholder="Market (country code)"
                      value={marketRecordForm.market}
                      onChange={(event) => setMarketRecordForm({ ...marketRecordForm, market: event.target.value })}
                    />
                    <Input
                      placeholder="Product type"
                      value={marketRecordForm.product_type}
                      onChange={(event) => setMarketRecordForm({ ...marketRecordForm, product_type: event.target.value })}
                    />
                    <Input
                      type="date"
                      value={marketRecordForm.metric_date}
                      onChange={(event) => setMarketRecordForm({ ...marketRecordForm, metric_date: event.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Weight KG"
                      value={marketRecordForm.value}
                      onChange={(event) => setMarketRecordForm({ ...marketRecordForm, value: event.target.value })}
                    />
                    <Button
                      onClick={async () => {
                        await createMarketRecord(selectedCustomerId, {
                          market: marketRecordForm.market,
                          product_type: marketRecordForm.product_type,
                          metric_date: marketRecordForm.metric_date,
                          value: Number(marketRecordForm.value || 0),
                          reason: "Admin market update",
                        });
                        setMarketRecordForm({ market: "", product_type: "", metric_date: "", value: "" });
                        await refreshData(selectedCustomerId);
                        toast({ title: "Market record created" });
                      }}
                    >
                      Add Record
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Market</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Weight KG</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.metric_date}</TableCell>
                          <TableCell>{row.market}</TableCell>
                          <TableCell>{row.product_type}</TableCell>
                          <TableCell>{row.value.toLocaleString()}</TableCell>
                          <TableCell className="space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                await updateMarketRecord(selectedCustomerId, row.source_record_id, {
                                  market: row.market,
                                  product_type: row.product_type,
                                  metric_date: row.metric_date,
                                  value: row.value + 1,
                                  reason: "Quick adjust +1 kg from backoffice",
                                });
                                await refreshData(selectedCustomerId);
                              }}
                            >
                              +1kg
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                await deleteMarketRecord(selectedCustomerId, row.source_record_id, "Removed invalid record");
                                await refreshData(selectedCustomerId);
                              }}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Preset</TableHead>
                        <TableHead>Filters</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {presetRows.map((preset) => (
                        <TableRow key={preset.id}>
                          <TableCell>{preset.name}</TableCell>
                          <TableCell>{JSON.stringify(preset.filters_json)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.sku}</TableCell>
                          <TableCell>{row.product_name}</TableCell>
                          <TableCell>{row.qty} {row.unit}</TableCell>
                          <TableCell>{new Date(row.updated_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices">
              <Card>
                <CardHeader>
                  <CardTitle>Invoices & Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.invoice_no}</TableCell>
                          <TableCell>{row.amount.toLocaleString()} {row.currency}</TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell>{row.due_date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Profile & Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 rounded border p-3 md:grid-cols-3">
                    <div className="space-y-1 md:col-span-2">
                      <Label>Customer Email</Label>
                      <Input
                        value={emailForm.newEmail}
                        onChange={(event) => setEmailForm({ ...emailForm, newEmail: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <Label>Reason (required for sensitive action)</Label>
                      <Input
                        value={emailForm.reason}
                        onChange={(event) => setEmailForm({ ...emailForm, reason: event.target.value })}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={emailForm.forceSignOutAllSessions}
                        onChange={(event) => setEmailForm({ ...emailForm, forceSignOutAllSessions: event.target.checked })}
                      />
                      Force sign-out all sessions
                    </label>
                    <div className="md:col-span-3">
                      <Button
                        onClick={async () => {
                          await changeCustomerEmail(selectedCustomerId, emailForm);
                          await refreshData(selectedCustomerId);
                          toast({ title: "Customer email updated" });
                        }}
                      >
                        Update Email
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await triggerPasswordReset(selectedCustomerId, "Admin requested reset");
                        await refreshData(selectedCustomerId);
                        toast({ title: "Password reset flow triggered" });
                      }}
                    >
                      Trigger Password Reset
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await signOutAllSessions(selectedCustomerId, "Security refresh requested");
                        await refreshData(selectedCustomerId);
                        toast({ title: "All active sessions revoked" });
                      }}
                    >
                      Sign Out All Devices
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Device</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.device_label}</TableCell>
                          <TableCell>{row.ip_address}</TableCell>
                          <TableCell>{new Date(row.last_seen_at).toLocaleString()}</TableCell>
                          <TableCell>{row.revoked_at ? "Revoked" : "Active"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Audit Log (selected customer)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Action</TableHead>
                            <TableHead>Actor</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{row.action}</TableCell>
                              <TableCell>{row.actor_email}</TableCell>
                              <TableCell>{row.reason || "-"}</TableCell>
                              <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
