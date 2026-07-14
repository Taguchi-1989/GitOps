import { spawnSync } from 'node:child_process';

export default function globalSetup() {
  const databaseUrl = process.env.E2E_DATABASE_URL ?? 'file:./e2e.db';
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(
      `Failed to prepare the E2E SQLite database (exit ${result.status ?? 'unknown'}).`
    );
  }
}
