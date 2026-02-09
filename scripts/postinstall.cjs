/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync } = require("node:child_process");

if (!process.env.DATABASE_URL) {
  console.log("[postinstall] Skipping prisma generate (DATABASE_URL not set)");
  process.exit(0);
}

try {
  execSync("prisma generate", { stdio: "inherit" });
} catch {
  console.log("[postinstall] prisma generate failed");
  process.exit(1);
}
