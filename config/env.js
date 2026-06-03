import dns from "node:dns";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Some routers/ISPs refuse AWS hostnames (ENOTFOUND). Use public DNS for AWS calls.
const usingLocalDynamo = Boolean(process.env.DYNAMODB_ENDPOINT?.trim());
if (!usingLocalDynamo) {
  const servers = (process.env.DNS_SERVERS || "8.8.8.8,8.8.4.4")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (servers.length > 0) {
    dns.setServers(servers);
  }
}
