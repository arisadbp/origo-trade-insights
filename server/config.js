import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(ROOT_DIR, "server", "data");
export const DB_PATH = process.env.ORIGO_DB_PATH || path.join(DATA_DIR, "origo-backoffice.db");
export const API_PORT = Number(process.env.API_PORT || 4000);
