import dns from "node:dns";
import dotenv from "dotenv";

dotenv.config({ path: new URL("./.env", import.meta.url) });

const mongoUri = process.env.MONGODB_URI || "";
if (mongoUri.startsWith("mongodb+srv://")) {
  const customDns = (process.env.MONGODB_DNS_SERVERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (customDns.length > 0) {
    dns.setServers(customDns);
  } else if (process.env.NODE_ENV !== "production") {
    // Some local/corporate resolvers refuse SRV lookups required by mongodb+srv://
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
}

await import("./index.js");
