import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12 overflow-hidden">
          <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-data-500/20 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <img src="/logo-origo.svg" alt="Origo logo" className="h-10 w-10 rounded-lg" />
            <div>
              <p className="text-xl font-semibold text-white">ORIGO Trade Insights</p>
              <p className="text-sm text-sidebar-foreground/70">Global market intelligence platform</p>
            </div>
          </div>
          <div className="relative z-10 max-w-md space-y-4">
            <h1 className="text-4xl font-semibold text-white">Make faster trade decisions</h1>
            <p className="text-base text-sidebar-foreground/70">
              Monitor HS code performance, track importer activity, and surface high-value buyers using one unified dashboard.
            </p>
            <div className="flex items-center gap-4 text-sm text-sidebar-foreground/70">
              <div className="rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2">
                Live market coverage
              </div>
              <div className="rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2">
                Country + company drilldowns
              </div>
            </div>
          </div>
          <div className="relative z-10 text-xs text-sidebar-foreground/50">
            © 2026 ORIGO Trade Insights. All rights reserved.
          </div>
        </div>

        <div className="flex flex-col items-center justify-center px-6 py-12">
          <div className="mb-8 flex w-full max-w-md items-center gap-3 lg:hidden">
            <img src="/logo-origo.svg" alt="Origo logo" className="h-9 w-9 rounded-lg" />
            <div>
              <p className="text-lg font-semibold">ORIGO Trade Insights</p>
              <p className="text-xs text-muted-foreground">Sign in to continue</p>
            </div>
          </div>

          <Card className="w-full max-w-md">
            <CardHeader className="space-y-2">
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>Use your company credentials to access the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="you@company.com" className="pl-10" required />
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
                Demo access: use any email and password to preview the interface. Authentication is not wired yet.
              </div>

              <p className="text-xs text-muted-foreground">
                Need access? Contact your workspace admin or request an invite.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
