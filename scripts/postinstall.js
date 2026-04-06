// scripts/postinstall.js
import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const plexDir = join(homedir(), '.plexcode');
mkdirSync(join(plexDir, 'sessions'), { recursive: true });

console.log('✦ plexcode: installing Chromium browser...');
try {
  execSync('npx playwright install chromium --with-deps', { stdio: 'inherit' });
  console.log('✦ plexcode: ready! Run `plexcode` to start.');
} catch {
  console.warn(
    '⚠  Could not install Chromium automatically.\n' +
    '   Run manually: npx playwright install chromium'
  );
}
