import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export default function BackOfficeLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-destructive/15 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <img src="/logo-origo.svg" alt="Origo logo" className="h-10 w-10 rounded-lg" />
            <div>
              <p className="text-xl font-semibold text-white">ORIGO Back Office</p>
              <p className="text-sm text-sidebar-foreground/70">Administration portal</p>
            </div>
          </div>
          <div className="relative z-10 max-w-md space-y-4">
            <h1 className="text-4xl font-semibold text-white">Operational control center</h1>
            <p className="text-base text-sidebar-foreground/70">
              Manage customer accounts, upload workflows, and internal user permissions in a dedicated back office environment.
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2 text-sm text-sidebar-foreground/80">
              <Shield className="h-4 w-4" />
              Back office account required
            </div>
          </div>
          <div className="relative z-10 text-xs text-sidebar-foreground/50">© 2026 ORIGO Trade Insights</div>
        </div>

        <div className="flex flex-col items-center justify-center px-6 py-12">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-2">
              <CardTitle>Back Office Sign In</CardTitle>
              <CardDescription>Use your ORIGO internal account credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  login("backoffice", email);
                  navigate("/admin", { replace: true });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="backoffice-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="backoffice-email"
                      type="email"
                      placeholder="you@origo.com"
                      className="pl-10"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backoffice-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="backoffice-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Sign in to Back Office
                </Button>
              </form>

              <div className="rounded-lg border bg-secondary/60 px-4 py-3 text-xs text-muted-foreground">
                Demo mode: any email/password can be used.
              </div>

              <p className="text-xs text-muted-foreground">
                Customer user? Go to the <Link to="/login" className="text-primary underline">customer login</Link>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
