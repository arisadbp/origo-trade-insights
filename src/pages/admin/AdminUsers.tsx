import { useMemo, useState, type FormEvent } from "react";
import { PlusCircle, Search } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { AdminUserRole, AdminUserStatus } from "@/types/admin";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminUsers() {
  const { adminUsers, createAdminUser, updateAdminUser } = useAdminData();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminUserRole>("analyst");

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return adminUsers;
    }

    return adminUsers.filter((user) =>
      [user.name, user.email, user.role, user.status].join(" ").toLowerCase().includes(keyword),
    );
  }, [adminUsers, search]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !email.trim()) {
      return;
    }

    createAdminUser({
      name,
      email,
      role,
    });

    setName("");
    setEmail("");
    setRole("analyst");
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar title="User Management" subtitle="Manage back office users, roles, and access status" />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invite admin user</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-4" onSubmit={submit}>
              <Input
                placeholder="Full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={role}
                onChange={(event) => setRole(event.target.value as AdminUserRole)}
              >
                <option value="owner">owner</option>
                <option value="manager">manager</option>
                <option value="analyst">analyst</option>
              </select>
              <Button type="submit" className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Add user
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-lg">Admin users</CardTitle>
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, email, role..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell>
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-sm capitalize"
                        value={user.role}
                        onChange={(event) =>
                          updateAdminUser(user.id, { role: event.target.value as AdminUserRole })
                        }
                      >
                        <option value="owner">owner</option>
                        <option value="manager">manager</option>
                        <option value="analyst">analyst</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            user.status === "active"
                              ? "default"
                              : user.status === "invited"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {user.status}
                        </Badge>
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-sm capitalize"
                          value={user.status}
                          onChange={(event) =>
                            updateAdminUser(user.id, {
                              status: event.target.value as AdminUserStatus,
                            })
                          }
                        >
                          <option value="active">active</option>
                          <option value="invited">invited</option>
                          <option value="disabled">disabled</option>
                        </select>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(user.lastLogin)}</TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No users found.
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
