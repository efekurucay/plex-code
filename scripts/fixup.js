// scripts/fixup.js — adds shebang + chmod to compiled CLI entry
import { readFileSync, writeFileSync, chmodSync } from 'fs';

const outFile = 'dist/cli.js';
const content = readFileSync(outFile, 'utf8');
writeFileSync(outFile, '#!/usr/bin/env node\n' + content);
chmodSync(outFile, '755');
console.log('✦ fixup: shebang added to dist/cli.js');
