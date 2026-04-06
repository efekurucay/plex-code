"""
browser.py  –  Playwright-based Perplexity web session manager.

First run  : opens visible Chromium so you can log in manually.
After login: session is saved to ~/.pplx_proxy_session.json and reused headlessly.
"""
import asyncio, json, os, time
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page

SESSION_FILE = Path.home() / ".pplx_proxy_session.json"
BASE_URL = "https://www.perplexity.ai"

# CSS selectors – update if Perplexity redesigns their UI
SELECTORS = {
    "textarea":    "textarea",
    "stop_button": "button[aria-label*='stop' i], button[aria-label*='cancel' i]",
    "answer":      [".prose", ".markdown", "[data-testid='answer']", "main"],
}


class PerplexityBrowser:
    def __init__(self, cfg):
        self.cfg = cfg
        self.ready = False
        self._lock = asyncio.Lock()
        self._pw = None
        self._browser = None
        self._ctx: BrowserContext = None
        self._page: Page = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self):
        self._pw = await async_playwright().start()
        headless = SESSION_FILE.exists()

        self._browser = await self._pw.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
        )

        ctx_opts = {
            "viewport": {"width": 1280, "height": 900},
            "locale": "en-US",
            "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
        }
        if SESSION_FILE.exists():
            ctx_opts["storage_state"] = str(SESSION_FILE)

        self._ctx = await self._browser.new_context(**ctx_opts)
        self._page = await self._ctx.new_page()

        await self._page.goto(BASE_URL, wait_until="domcontentloaded")
        await asyncio.sleep(3)

        if not await self._is_logged_in():
            print("\n[proxy] Browser opened – please log in to Perplexity, then press ENTER here.")
            input()
            await asyncio.sleep(2)

        await self._ctx.storage_state(path=str(SESSION_FILE))
        print("[proxy] Session saved. Future runs will be headless.")
        self.ready = True

    async def stop(self):
        try:
            if self._ctx:
                await self._ctx.storage_state(path=str(SESSION_FILE))
            if self._browser:
                await self._browser.close()
            if self._pw:
                await self._pw.stop()
        except Exception:
            pass

    # ── Core ask ──────────────────────────────────────────────────────────────

    async def ask(self, prompt: str) -> str:
        async with self._lock:
            return await self._do_ask(prompt)

    async def _do_ask(self, prompt: str) -> str:
        page = self._page

        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await asyncio.sleep(1.5)

        try:
            textarea = await page.wait_for_selector(SELECTORS["textarea"], timeout=12_000)
        except Exception:
            return "[proxy error] Could not find Perplexity input box."

        await textarea.click()
        await page.keyboard.press("Control+a")
        await textarea.fill("")

        CHUNK = 1800
        for i in range(0, len(prompt), CHUNK):
            await textarea.type(prompt[i:i+CHUNK], delay=0)

        await page.keyboard.press("Enter")
        await asyncio.sleep(1.5)

        await self._wait_for_done(page)
        return await self._extract(page)

    async def _wait_for_done(self, page: Page, timeout: int = 120):
        """Poll until the stop/cancel button is gone."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            n = await page.locator(SELECTORS["stop_button"]).count()
            if n == 0:
                await asyncio.sleep(0.8)
                break
            await asyncio.sleep(0.6)

    async def _extract(self, page: Page) -> str:
        for sel in SELECTORS["answer"]:
            try:
                els = await page.query_selector_all(sel)
                if els:
                    chunks = [await el.inner_text() for el in els]
                    text = "\n".join(c.strip() for c in chunks if c.strip())
                    if text:
                        return text
            except Exception:
                continue
        return "[proxy error] Could not extract Perplexity response."

    async def _is_logged_in(self) -> bool:
        try:
            el = await self._page.query_selector(SELECTORS["textarea"])
            return el is not None
        except Exception:
            return False
