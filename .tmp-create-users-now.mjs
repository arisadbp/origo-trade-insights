import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envRaw = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const candidates = [
  { email: 'admin@origo.com', password: 'admin01', username: 'admin', role: 'ADMIN' },
  { email: 'trrgroup@origo.com', password: 'trrgroup', username: 'trrgroup', role: 'CUSTOMER' },
];

for (const c of candidates) {
  const signUp = await supabase.auth.signUp({ email: c.email, password: c.password });
  const userId = signUp.data?.user?.id ?? null;
  console.log(JSON.stringify({
    email: c.email,
    username: c.username,
    role: c.role,
    password_set: c.password,
    user_id: userId,
    signup_error: signUp.error?.message ?? null,
  }));

  if (!userId) {
    const signIn = await supabase.auth.signInWithPassword({ email: c.email, password: c.password });
    console.log(JSON.stringify({
      email: c.email,
      sign_in_user_id: signIn.data?.user?.id ?? null,
      sign_in_error: signIn.error?.message ?? null,
    }));
    if (signIn.data?.session) await supabase.auth.signOut();
  }
}
