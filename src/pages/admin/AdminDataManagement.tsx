import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminData } from "@/contexts/AdminDataContext";
import type { UploadProcessingStatus, UploadReviewStatus } from "@/types/admin";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const statusOptions: UploadProcessingStatus[] = ["uploading", "processing", "ready", "error"];
const reviewOptions: UploadReviewStatus[] = ["updated", "pending", "cancel"];

const toneByStatus: Record<UploadProcessingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  processing: "secondary",
  uploading: "outline",
  error: "destructive",
};

export default function AdminDataManagement() {
  const { uploads, customers, updateUpload, deleteUpload, getCustomerName } = useAdminData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UploadProcessingStatus | "all">("all");
  const [reviewFilter, setReviewFilter] = useState<UploadReviewStatus | "all">("all");
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const managedUploads = useMemo(
    () => uploads.filter((upload) => customerById.has(upload.customerId)),
    [uploads, customerById],
  );

  const filteredUploads = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return managedUploads.filter((upload) => {
      const customer = customerById.get(upload.customerId);
      const matchesKeyword =
        !keyword ||
        [
          upload.fileName,
          upload.description,
          customer?.companyName ?? "",
          customer?.contactName ?? "",
          customer?.email ?? "",
          upload.reviewStatus,
          upload.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStatus = statusFilter === "all" || upload.status === statusFilter;
      const matchesReview = reviewFilter === "all" || upload.reviewStatus === reviewFilter;

      return matchesKeyword && matchesStatus && matchesReview;
    });
  }, [managedUploads, search, statusFilter, reviewFilter, customerById]);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Data & Upload Management"
        subtitle="Review files submitted by ORIGO-created customer users"
      />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total Files</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{managedUploads.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pending Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {managedUploads.filter((item) => item.reviewStatus === "pending").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customers Linked</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {new Set(managedUploads.map((item) => item.customerId)).size}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-lg">Upload records</CardTitle>
            <p className="text-xs text-muted-foreground">
              Only files from customer users created and linked by ORIGO are shown here.
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search file, customer user, status..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as UploadProcessingStatus | "all")}
              >
                <option value="all">All status</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={reviewFilter}
                onChange={(event) => setReviewFilter(event.target.value as UploadReviewStatus | "all")}
              >
                <option value="all">All reviews</option>
                {reviewOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Customer User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUploads.map((upload) => {
                  const customer = customerById.get(upload.customerId);

                  return (
                    <TableRow key={upload.id}>
                      <TableCell>
                        <p className="font-medium">{upload.fileName}</p>
                        <p className="text-xs text-muted-foreground">{upload.fileSize}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{customer?.companyName ?? getCustomerName(upload.customerId)}</p>
                        <p className="text-xs text-muted-foreground">{customer?.email ?? upload.uploadedBy}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={toneByStatus[upload.status]}>{upload.status}</Badge>
                          <select
                            className="h-8 rounded-md border bg-background px-2 text-sm"
                            value={upload.status}
                            onChange={(event) =>
                              updateUpload(upload.id, {
                                status: event.target.value as UploadProcessingStatus,
                              })
                            }
                          >
                            {statusOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-sm"
                          value={upload.reviewStatus}
                          onChange={(event) =>
                            updateUpload(upload.id, {
                              reviewStatus: event.target.value as UploadReviewStatus,
                            })
                          }
                        >
                          {reviewOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(upload.uploadedAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" onClick={() => deleteUpload(upload.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredUploads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No upload records match filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
