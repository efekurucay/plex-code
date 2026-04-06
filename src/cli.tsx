import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { App } from './app.js';

const pkg = { version: '0.1.0' };

const program = new Command();

program
  .name('plexcode')
  .description('Perplexity AI terminal assistant — search, research, and code')
  .version(pkg.version)
  .argument('[prompt]', 'Optional prompt to send immediately on launch')
  .option('-m, --model <model>', 'Model to use (sonar, gpt-5.4, claude-sonnet-4.6, ...)')
  .option('--mode <mode>', 'Search mode (default, deep-research, create, learn, model-council)')
  .action((prompt?: string) => {
    const { waitUntilExit } = render(<App initialPrompt={prompt} />, {
      exitOnCtrlC: false, // we handle Ctrl+C ourselves
    });
    void waitUntilExit();
  });

program
  .command('logout')
  .description('Clear saved Perplexity session')
  .action(async () => {
    const { default: fs } = await import('fs');
    const { default: path } = await import('path');
    const { default: os } = await import('os');
    const sessionFile = path.join(os.homedir(), '.plexcode', 'session.json');
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
      console.log('✦ Session cleared. Next run will open the browser to log in.');
    } else {
      console.log('No session found.');
    }
  });

program.parse(process.argv);
