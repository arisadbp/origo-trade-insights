import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envPath = ".env.local";
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const envRaw = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const index = trimmed.indexOf("=");
  if (index === -1) continue;
  env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const { data, error } = await supabase
  .from("stock")
  .select("*")
  .limit(5);

console.log("data:");
console.log(JSON.stringify(data, null, 2));
console.log("error:");
console.log(JSON.stringify(error, null, 2));
