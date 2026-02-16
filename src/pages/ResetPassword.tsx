import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  useEffect(() => {
    let active = true;

    const ensureRecoverySession = async () => {
      if (!isSupabaseConfigured || !supabase) {
        if (active) setError("Authentication is not configured.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setError("Reset link is invalid or expired. Please request a new one.");
        return;
      }
      setIsReady(true);
    };

    void ensureRecoverySession();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-lg items-center justify-center">
        <Card className="w-full">
          <CardHeader className="space-y-2">
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Set your new password securely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!isReady) return;
                if (password.length < 8) {
                  setError("Password must be at least 8 characters.");
                  return;
                }
                if (password !== confirmPassword) {
                  setError("Passwords do not match.");
                  return;
                }

                setError(null);
                setIsSubmitting(true);
                const result = await resetPassword(password);
                setIsSubmitting(false);
                if (!result.success) {
                  setError(result.error ?? "Unable to reset password.");
                  return;
                }

                setMessage("Password updated successfully. Please sign in again.");
                setTimeout(() => navigate("/login", { replace: true }), 1200);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={!isReady}
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={!isReady}
                  required
                />
              </div>

              {error ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {message}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting || !isReady}>
                {isSubmitting ? "Updating..." : "Update Password"}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground">
              Back to <Link to="/login" className="text-primary underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
