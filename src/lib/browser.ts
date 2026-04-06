import path from 'path';
import os from 'os';
import fs from 'fs';
import { chromium, type Browser, type BrowserContext, type Page, type ElementHandle } from 'playwright';
import type { AskOptions } from '../types.js';

const PLEX_DIR = path.join(os.homedir(), '.plexcode');
const SESSION_FILE = path.join(PLEX_DIR, 'session.json');
const BASE_URL = 'https://www.perplexity.ai';

const INPUT_SELECTORS = [
  "[role='textbox']",
  'textarea#ask-input',
  'textarea',
  "[contenteditable='true']",
];

const MODE_MAP: Record<string, string> = {
  'deep-research': 'Deep research',
  'model-council': 'Model council',
  'create':        'Create files and apps',
  'learn':         'Learn step by step',
};

export class PerplexityBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private _interrupted = false;

  hasSession(): boolean {
    return fs.existsSync(SESSION_FILE);
  }

  async start(headless?: boolean): Promise<void> {
    fs.mkdirSync(PLEX_DIR, { recursive: true });
    const runHeadless = headless ?? this.hasSession();

    this.browser = await chromium.launch({
      headless: runHeadless,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    });

    const ctxOpts: Record<string, unknown> = {
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    };

    if (fs.existsSync(SESSION_FILE)) {
      ctxOpts['storageState'] = SESSION_FILE;
    }

    this.context = await this.browser.newContext(ctxOpts);
    this.page = await this.context.newPage();
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000);
  }

  /** Call after user manually logs in — saves session for next headless run. */
  async saveSession(): Promise<void> {
    await this.context!.storageState({ path: SESSION_FILE });
  }

  async newChat(): Promise<void> {
    if (!this.page) return;
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000);
  }

  interrupt(): void {
    this._interrupted = true;
  }

  async ask(prompt: string, opts: AskOptions = {}): Promise<string> {
    const page = this.page!;
    this._interrupted = false;

    // We no longer goto BASE_URL here to maintain the same thread.
    // Ensure we are ready
    await page.waitForTimeout(500);

    if (opts.mode && opts.mode !== 'default') {
      await this._selectMode(page, opts.mode);
    }
    if (opts.model) {
      await this._selectModel(page, opts.model);
    }

    const input = await this._findInput(page);
    if (!input) throw new Error('Could not find Perplexity input box.');

    await input.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    try {
      await input.fill(prompt);
    } catch {
      for (let i = 0; i < prompt.length; i += 1800) {
        await input.type(prompt.slice(i, i + 1800), { delay: 0 });
      }
    }

    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    await this._waitForDone(page);
    return this._extractResponse(page);
  }

  async stop(): Promise<void> {
    try {
      if (this.context) await this.context.storageState({ path: SESSION_FILE });
      if (this.browser) await this.browser.close();
    } catch { /* ignore */ }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async _findInput(page: Page): Promise<ElementHandle | null> {
    for (const sel of INPUT_SELECTORS) {
      try {
        const el = await page.waitForSelector(sel, { timeout: 6000, state: 'visible' });
        if (el) return el;
      } catch { /* try next */ }
    }
    return null;
  }

  private async _selectMode(page: Page, mode: string): Promise<void> {
    const input = await this._findInput(page);
    if (!input) return;
    await input.click();
    await page.keyboard.type('/');
    await page.waitForTimeout(600);
    const label = MODE_MAP[mode] ?? mode;
    try {
      await page.click(`text=${label}`, { timeout: 3000 });
      await page.waitForTimeout(400);
    } catch {
      await page.keyboard.press('Escape');
    }
  }

  private async _selectModel(page: Page, modelName: string): Promise<void> {
    try {
      await page.click("button[aria-label='Model']", { timeout: 3000 });
      await page.waitForTimeout(500);
      await page.click(`text=${modelName}`, { timeout: 3000 });
      await page.waitForTimeout(300);
    } catch { /* ignore — model stays as is */ }
  }

  private async _waitForDone(page: Page, timeoutMs = 120_000): Promise<void> {
    const stopSel = "button[aria-label*='stop' i], button[aria-label*='cancel' i]";
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this._interrupted) {
        this._interrupted = false;
        try {
          await page.click(stopSel, { timeout: 1000 });
        } catch { /* ignore if already stopped */ }
        break;
      }
      
      if ((await page.locator(stopSel).count()) === 0) {
        await page.waitForTimeout(800);
        break;
      }
      await page.waitForTimeout(600);
    }
  }

  private async _extractResponse(page: Page): Promise<string> {
    const selectors = ['.prose', '.markdown', '[data-testid="answer"]', '.cl-prose', 'main'];
    for (const sel of selectors) {
      try {
        const els = await page.$$(sel);
        if (els.length) {
          // Getting only the last block to support continuing threads
          const text = await els[els.length - 1].innerText();
          if (text && text.trim()) return text.trim();
        }
      } catch { /* try next */ }
    }
    return '[Could not extract response from Perplexity]';
  }
}
