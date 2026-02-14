import { Building2, FileUp, ShieldCheck, Users } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const uploadStatusTone: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  processing: "secondary",
  uploading: "outline",
  error: "destructive",
};

export default function AdminDashboard() {
  const { customers, adminUsers, uploads, activityLogs, getCustomerName } = useAdminData();

  const activeCustomers = customers.filter((item) => item.status === "active").length;
  const pendingReviews = uploads.filter((item) => item.reviewStatus === "pending").length;
  const recentUploads = [...uploads]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 5);
  const latestActivities = [...activityLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="flex h-full flex-col">
      <TopBar title="ORIGO Back Office" subtitle="Admin dashboard for customer data and uploads" />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{customers.length}</p>
              <p className="text-sm text-muted-foreground">{activeCustomers} active accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Admin Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{adminUsers.length}</p>
              <p className="text-sm text-muted-foreground">
                {adminUsers.filter((item) => item.status === "active").length} active users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileUp className="h-4 w-4" />
                Uploads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{uploads.length}</p>
              <p className="text-sm text-muted-foreground">{pendingReviews} pending reviews</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">Stable</p>
              <p className="text-sm text-muted-foreground">All core modules online</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Recent Uploads</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead>Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentUploads.map((upload) => (
                    <TableRow key={upload.id}>
                      <TableCell className="font-medium">{upload.fileName}</TableCell>
                      <TableCell>{getCustomerName(upload.customerId)}</TableCell>
                      <TableCell>
                        <Badge variant={uploadStatusTone[upload.status] ?? "outline"}>{upload.status}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{upload.reviewStatus}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(upload.uploadedAt)}</TableCell>
                    </TableRow>
                  ))}
                  {recentUploads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No uploads yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Activity Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {latestActivities.map((activity) => (
                <div key={activity.id} className="rounded-lg border bg-secondary/20 p-3">
                  <p className="text-sm font-medium">{activity.message}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{activity.actor}</span>
                    <span>{formatDate(activity.createdAt)}</span>
                  </div>
                </div>
              ))}
              {latestActivities.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
