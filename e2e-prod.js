// Запуск E2E на продакшене одной командой, одинаково в Windows / macOS / Linux:
//   npm run e2e:prod                       — адрес по умолчанию (ниже)
//   E2E_BASE_URL=https://... npm run e2e:prod — свой адрес
import { spawnSync } from 'node:child_process';

const DEFAULT_URL = 'https://agromarket-kaplinnikitos-alt.vercel.app';
const baseURL = process.env.E2E_BASE_URL || DEFAULT_URL;

console.log(`E2E на ${baseURL}`);
const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true, // нужно в Windows, где npx — это npx.cmd
  env: { ...process.env, E2E_BASE_URL: baseURL },
});
process.exit(result.status ?? 1);
