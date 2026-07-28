const { readdirSync, statSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

function collect(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    return statSync(fullPath).isDirectory() ? collect(fullPath) : fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

let failed = false;
for (const file of [...collect('src'), ...collect('scripts')].filter((name) => !name.endsWith('check-syntax.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
if (failed) process.exit(1);
