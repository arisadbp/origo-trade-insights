import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:items-center lg:justify-center">
          <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-data-500/20 blur-3xl" />
          <div className="relative z-10 mx-auto max-w-xl space-y-6 text-center">
            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-[2rem] border border-white/10 bg-sidebar-accent/40 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
              <div className="flex h-full w-full items-center justify-center rounded-[1.6rem] border border-white/15 bg-sidebar-accent/80">
                <Building2 className="h-16 w-16 text-primary" />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-4xl font-semibold tracking-tight text-white">Configured for your company.</p>
            </div>
            <p className="mx-auto max-w-lg text-base leading-relaxed text-sidebar-foreground/70">
              This workspace is customized for your organization&apos;s structure, trade flow, and decision-making context.
            </p>
            <div className="inline-flex rounded-full border border-sidebar-border bg-sidebar-accent px-4 py-2 text-sm text-sidebar-foreground/80">
              Built around your company, not a generic template.
            </div>
          </div>
          <div className="absolute bottom-10 left-0 right-0 text-center text-xs text-sidebar-foreground/50">
            © 2026 ORIGO Trade Insights. All rights reserved.
          </div>
        </div>

        <div className="flex flex-col items-center justify-center px-6 py-12">
          <div className="mb-8 flex w-full max-w-md flex-col items-center gap-3 text-center lg:hidden">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-border/70 bg-muted/30 p-2">
              <div className="flex h-full w-full items-center justify-center rounded-2xl border border-border/70 bg-background">
                <Building2 className="h-10 w-10 text-primary" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Configured for your company.</p>
            </div>
          </div>

          <Card className="w-full max-w-md">
            <CardHeader className="space-y-2">
              <CardTitle>Customer Sign In</CardTitle>
              <CardDescription>Use your client account to access your company dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  login("customer", email);
                  navigate("/market-intelligence", { replace: true });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      className="pl-10"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
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

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked={remember} onCheckedChange={(value) => setRemember(Boolean(value))} />
                    Remember me
                  </label>
                  <a href="#" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </a>
                </div>

                <Button type="submit" className="w-full">
                  Sign in
                </Button>
              </form>

              <div className="rounded-lg border bg-secondary/60 px-4 py-3 text-xs text-muted-foreground">
                Demo mode: any email/password can be used.
              </div>

              <p className="text-xs text-muted-foreground">
                ORIGO internal staff? Go to <Link className="text-primary underline" to="/backoffice/login">Back Office login</Link>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
