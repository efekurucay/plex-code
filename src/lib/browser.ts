import path from 'path';
import os from 'os';
import fs from 'fs';
import { chromium, type Browser, type BrowserContext, type Page, type ElementHandle } from 'playwright';
import type { AskOptions } from '../types.js';
import { executeTool } from './toolExecutor.js';

const PLEX_DIR    = path.join(os.homedir(), '.plexcode');
const SESSION_FILE = path.join(PLEX_DIR, 'session.json');
const BASE_URL     = 'https://www.perplexity.ai';

/** Maximum agentic tool-call iterations per user query. */
const MAX_TOOL_LOOPS = 4;

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

/** System preamble injected into the first message of each chat thread. */
const AGENT_PREAMBLE = `\
[System] You have access to the user's local file system through special tool commands.
To use a tool, reply with an XML-style tag and STOP writing immediately after the closing tag:
<TOOL>command here</TOOL>

Allowed commands: cat, ls, head, tail, grep, find, wc, pwd, file, tree, echo, stat

Examples:
  <TOOL>ls -la src/</TOOL>
  <TOOL>cat src/lib/browser.ts</TOOL>
  <TOOL>grep -rn "TODO" src/</TOOL>
  <TOOL>head -n 50 src/app.tsx</TOOL>

Rules:
1. You may call at most ${MAX_TOOL_LOOPS} tools per question.
2. After emitting a <TOOL> tag, STOP — write nothing else until you receive the result.
3. Once you have enough context, write your final answer as normal markdown WITHOUT any <TOOL> tags.
4. If you don't need file context to answer the question, answer directly without using any tools.

`;

/** Strip any residual <TOOL>...</TOOL> blocks from the final response. */
function cleanResponse(text: string): string {
  return text.replace(/<TOOL>[\s\S]*?<\/TOOL>/gi, '').trim();
}

export class PerplexityBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private _interrupted     = false;
  /** Tracks whether the agentic preamble has been injected into the current thread. */
  private _preambleInjected = false;

  hasSession(): boolean {
    return fs.existsSync(SESSION_FILE);
  }

  async start(headless?: boolean): Promise<void> {
    fs.mkdirSync(PLEX_DIR, { recursive: true });
    const runHeadless = headless ?? this.hasSession();

    const launchOpts = {
      headless: runHeadless,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    };

    try {
      // Trying local Chrome first avoids Cloudflare blocking automated browsers
      this.browser = await chromium.launch({ ...launchOpts, channel: 'chrome' });
    } catch {
      // Fallback to bundled chromium
      this.browser = await chromium.launch(launchOpts);
    }

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
    this.page    = await this.context.newPage();
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000);
  }

  /** Call after user manually logs in — saves session for next headless run. */
  async saveSession(): Promise<void> {
    await this.context!.storageState({ path: SESSION_FILE });
  }

  async newChat(): Promise<void> {
    if (!this.page) return;
    // Reset preamble so it re-injects on the next message of the new thread.
    this._preambleInjected = false;
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000);
  }

  interrupt(): void {
    this._interrupted = true;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Send a prompt to Perplexity and return the final answer string.
   *
   * Implements the Shadow Agentic Loop:
   *  1. Prepend the tool-use system preamble on the first message of the thread.
   *  2. Wait for the AI's response.
   *  3. If the response contains a <TOOL> tag, execute the command locally.
   *  4. Feed the tool output back to Perplexity as a new message.
   *  5. Repeat up to MAX_TOOL_LOOPS times, then return the final answer.
   */
  async ask(prompt: string, opts: AskOptions = {}): Promise<string> {
    const page = this.page!;
    this._interrupted = false;

    // ── 1. Build the augmented prompt (inject preamble once per thread) ──────
    const augmented = this._preambleInjected
      ? prompt
      : AGENT_PREAMBLE + prompt;
    this._preambleInjected = true;

    if (opts.mode && opts.mode !== 'default') {
      await this._selectMode(page, opts.mode);
    }
    if (opts.model) {
      await this._selectModel(page, opts.model);
    }

    // ── 2. Submit the initial user message ───────────────────────────────────
    await this._submitMessage(page, augmented);

    // ── 3. Agentic loop ──────────────────────────────────────────────────────
    let loopCount = 0;

    while (loopCount < MAX_TOOL_LOOPS) {
      await this._waitForDone(page);

      const response = await this._extractResponse(page);

      // Check for a tool call — match the FIRST tag only per response
      const toolMatch = response.match(/<TOOL>([\s\S]*?)<\/TOOL>/i);
      if (!toolMatch) {
        // No tool call → the AI has its final answer
        break;
      }

      loopCount++;
      const command = toolMatch[1].trim();

      // Notify the UI (so the spinner can show live status)
      opts.onAgentLoop?.(loopCount, command);

      // ── Execute the tool locally ─────────────────────────────────────────
      const toolOutput = await executeTool(command);

      // ── Feed result back to Perplexity ───────────────────────────────────
      const feedback =
        `[Tool Result — "${command}"]\n\n${toolOutput}`;

      await this._submitMessage(page, feedback);
    }

    // ── 4. Extract & clean the final answer ──────────────────────────────────
    const finalResponse = await this._extractResponse(page);
    return cleanResponse(finalResponse);
  }

  async stop(): Promise<void> {
    try {
      if (this.context) await this.context.storageState({ path: SESSION_FILE });
      if (this.browser) await this.browser.close();
    } catch { /* ignore */ }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Core message submission — fills the input box and presses Enter.
   * Used by both the initial prompt and autonomous tool-result feedback.
   */
  private async _submitMessage(page: Page, text: string): Promise<void> {
    await page.waitForTimeout(500);

    const input = await this._findInput(page);
    if (!input) throw new Error('Could not find Perplexity input box.');

    await input.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    try {
      await input.fill(text);
    } catch {
      // fill() can fail for contenteditable — fall back to chunked typing
      for (let i = 0; i < text.length; i += 1800) {
        await input.type(text.slice(i, i + 1800), { delay: 0 });
      }
    }

    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
  }

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
          // Get only the last block to support continuing threads
          const text = await els[els.length - 1].innerText();
          if (text && text.trim()) return text.trim();
        }
      } catch { /* try next */ }
    }
    return '[Could not extract response from Perplexity]';
  }
}
