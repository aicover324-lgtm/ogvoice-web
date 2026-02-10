/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync } = require("node:child_process");

// `prisma generate` does not require a database connection.
// Always generate on install so production builds (e.g. Vercel) don't depend
// on DATABASE_URL being present during install.
try {
  execSync("prisma generate", { stdio: "inherit" });
} catch {
  console.log("[postinstall] prisma generate failed");
  process.exit(1);
}
