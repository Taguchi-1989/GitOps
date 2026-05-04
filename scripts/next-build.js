const { spawnSync } = require('child_process');

const nextPackage = require('next/package.json');
const nextMajor = Number.parseInt(nextPackage.version.split('.')[0], 10);
const nextCli = require.resolve('next/dist/bin/next');
const args = ['build'];

if (nextMajor >= 16) {
  args.push('--webpack');
}

const result = spawnSync(process.execPath, [nextCli, ...args], { stdio: 'inherit' });

process.exit(result.status ?? 1);
