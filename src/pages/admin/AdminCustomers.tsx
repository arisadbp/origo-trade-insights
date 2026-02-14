import { useMemo, useState, type FormEvent } from "react";
import { Edit3, PlusCircle, Search, Trash2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { CustomerStatus } from "@/types/admin";

const emptyForm = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  country: "",
  notes: "",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminCustomers() {
  const { customers, createCustomer, updateCustomer, deleteCustomer } = useAdminData();
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return customers;
    }

    return customers.filter((customer) =>
      [
        customer.companyName,
        customer.contactName,
        customer.email,
        customer.country,
        customer.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [customers, search]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.companyName.trim() || !form.contactName.trim() || !form.email.trim()) {
      return;
    }

    if (editingId) {
      updateCustomer(editingId, form);
    } else {
      createCustomer(form);
    }

    setForm(emptyForm);
    setEditingId(null);
  };

  const beginEdit = (customerId: string) => {
    const target = customers.find((item) => item.id === customerId);
    if (!target) {
      return;
    }

    setEditingId(customerId);
    setForm({
      companyName: target.companyName,
      contactName: target.contactName,
      email: target.email,
      phone: target.phone,
      country: target.country,
      notes: target.notes,
    });
  };

  const toggleStatus = (customerId: string, currentStatus: CustomerStatus) => {
    updateCustomer(customerId, {
      status: currentStatus === "active" ? "paused" : "active",
    });
  };

  const remove = (customerId: string) => {
    const target = customers.find((item) => item.id === customerId);
    if (!target) {
      return;
    }

    if (!window.confirm(`Delete customer ${target.companyName}?`)) {
      return;
    }

    deleteCustomer(customerId);
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Customer Management" subtitle="Edit customer profiles and account status" />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "Edit customer" : "Create customer"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
              <Input
                placeholder="Company name"
                value={form.companyName}
                onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                required
              />
              <Input
                placeholder="Contact name"
                value={form.contactName}
                onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
                required
              />
              <Input
                type="email"
                placeholder="Contact email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                required
              />
              <Input
                placeholder="Phone"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
              <Input
                placeholder="Country"
                value={form.country}
                onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
              />
              <div className="md:col-span-2">
                <Textarea
                  rows={3}
                  placeholder="Notes"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                <Button type="submit" className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  {editingId ? "Save customer" : "Add customer"}
                </Button>

                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-lg">Customer list</CardTitle>
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search customer, contact, country..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <p className="font-medium">{customer.companyName}</p>
                      <p className="text-xs text-muted-foreground">{customer.country || "-"}</p>
                    </TableCell>
                    <TableCell>
                      <p>{customer.contactName}</p>
                      <p className="text-xs text-muted-foreground">{customer.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(customer.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => beginEdit(customer.id)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleStatus(customer.id, customer.status)}
                        >
                          {customer.status === "active" ? "Pause" : "Activate"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => remove(customer.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No customer found.
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
