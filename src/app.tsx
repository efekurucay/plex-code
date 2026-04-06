import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';

import { theme } from './theme.js';
import { PerplexityBrowser } from './lib/browser.js';
import { config } from './lib/config.js';
import { MODELS, MODES } from './types.js';
import type { Message, Model, SearchMode, Overlay, AppScreen } from './types.js';

import { Header } from './components/Header.js';
import { MessageList } from './components/MessageList.js';
import { InputArea } from './components/InputArea.js';
import { StatusBar } from './components/StatusBar.js';
import { ModelPicker } from './components/ModelPicker.js';
import { ModePicker } from './components/ModePicker.js';
import { LoginScreen } from './components/LoginScreen.js';
import { Spinner } from './components/Spinner.js';

interface Props {
  initialPrompt?: string;
}

export function App({ initialPrompt }: Props) {
  const { exit } = useApp();

  const [screen, setScreen]           = useState<AppScreen>('loading');
  const [messages, setMessages]       = useState<Message[]>([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [overlay, setOverlay]         = useState<Overlay>(null);
  const [error, setError]             = useState<string | null>(null);
  /** Live status label shown in the spinner during agentic tool loops. */
  const [agentStatus, setAgentStatus] = useState<string | null>(null);

  const savedModelId = config.get('defaultModel');
  const [currentModel, setCurrentModel] = useState<Model>(
    () => MODELS.find((m) => m.id === savedModelId) ?? MODELS[0],
  );
  const savedModeId = config.get('defaultMode');
  const [currentMode, setCurrentMode]   = useState<SearchMode>(
    () => MODES.find((m) => m.id === savedModeId) ?? MODES[0],
  );

  const browser = useRef<PerplexityBrowser | null>(null);

  const doExit = () => {
    if (browser.current) {
      // Force exit after browser stops
      void browser.current.stop().finally(() => {
        exit();
        process.exit(0);
      });
    } else {
      exit();
      process.exit(0);
    }
  };

  // Global shortcuts
  useInput((_char, key) => {
    // Quit on Ctrl+C when no overlay active
    if (key.ctrl && _char === 'c') doExit();
    
    // Interrupt AI generation on Escape
    if (key.escape && isLoading && browser.current) {
      browser.current.interrupt();
    }
  });

  // Init browser on mount
  useEffect(() => {
    const b = new PerplexityBrowser();
    browser.current = b;

    async function init() {
      try {
        if (b.hasSession()) {
          await b.start(true);
          setScreen('chat');
          if (initialPrompt) void handleAsk(initialPrompt);
        } else {
          await b.start(false); // visible for login
          setScreen('login');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setScreen('chat');
      }
    }

    void init();
    return () => { void browser.current?.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin() {
    if (!browser.current) return;
    await browser.current.saveSession();
    setScreen('chat');
  }

  // ── Slash commands ─────────────────────────────────────────────────────
  function handleSlashCommand(cmd: string): boolean {
    switch (cmd.toLowerCase().trim()) {
      case '/mode':   setOverlay('mode');   return true;
      case '/model':  setOverlay('model');  return true;
      case '/login':  void handleLoginPrompt(); return true;
      case '/new':
        setMessages([]);
        void browser.current?.newChat();
        return true;
      case '/quit':   doExit();             return true;
      case '/logout': void handleLogout();  return true;
      case '/help': {

        const helpMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: [
            '**PlexCode slash commands**',
            '',
            '`/mode`    — Change search mode (Deep Research, Create, etc.)',
            '`/model`   — Switch AI model (Sonar, GPT-5.4, Claude, etc.)',
            '`/new`     — Start a new conversation',
            '`/logout`  — Clear session and log out of Perplexity',
            '`/quit`    — Exit plexcode',
            '`/help`    — Show this message',
          ].join('\n'),
          timestamp: new Date(),
        };
        setMessages((m) => [...m, helpMsg]);
        return true;
      }
      default: return false;
    }
  }

  async function handleLogout() {
    const { default: fs } = await import('fs');
    const { default: path } = await import('path');
    const { default: os } = await import('os');
    const sessionFile = path.join(os.homedir(), '.plexcode', 'session.json');
    if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
    exit();
  }

  async function handleLoginPrompt() {
    // Restart browser in visible mode for login
    if (browser.current) await browser.current.stop();
    setScreen('loading');
    
    const b = new PerplexityBrowser();
    browser.current = b;
    await b.start(false);
    setScreen('login');
  }

  async function handleAsk(text: string) {
    // Route slash commands
    if (text.startsWith('/')) {
      handleSlashCommand(text);
      return;
    }

    if (!browser.current || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((m) => [...m, userMsg]);
    setIsLoading(true);
    setError(null);

    try {
      const modelName =
        currentModel.id !== 'sonar' ? currentModel.name : undefined;
      const modeId =
        currentMode.id !== 'default' ? currentMode.id : undefined;

      const raw = await browser.current.ask(text, {
        model: modelName,
        mode: modeId,
        onAgentLoop: (iteration, command) => {
          setAgentStatus(`⚡ Tool ${iteration}/${4}: ${command}`);
        },
      });

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: raw,
        model: currentModel.name,
        mode: currentMode.id !== 'default' ? currentMode.name : undefined,
        timestamp: new Date(),
      };
      setMessages((m) => [...m, aiMsg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
      setAgentStatus(null);
    }
  }

  function handleModelSelect(m: Model) {
    setCurrentModel(m);
    config.set('defaultModel', m.id);
    setOverlay(null);
  }

  function handleModeSelect(m: SearchMode) {
    setCurrentMode(m);
    config.set('defaultMode', m.id);
    setOverlay(null);
  }

  // ── Screens ──────────────────────────────────────────────────────────────

  if (screen === 'loading') {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Spinner label="Starting Perplexity..." />
      </Box>
    );
  }

  if (screen === 'login') {
    return (
      <Box flexDirection="column" height={process.stdout.rows}>
        <LoginScreen onDone={handleLogin} />
      </Box>
    );
  }

  // ── Main content area: overlay OR chat ──────────────────────────────────
  const mainContent = () => {
    if (overlay === 'model') {
      return (
        <Box flexGrow={1} flexDirection="column" paddingX={2} paddingY={1}>
          <ModelPicker
            models={MODELS}
            current={currentModel}
            onSelect={handleModelSelect}
            onCancel={() => setOverlay(null)}
          />
        </Box>
      );
    }
    if (overlay === 'mode') {
      return (
        <Box flexGrow={1} flexDirection="column" paddingX={2} paddingY={1}>
          <ModePicker
            modes={MODES}
            current={currentMode}
            onSelect={handleModeSelect}
            onCancel={() => setOverlay(null)}
          />
        </Box>
      );
    }
    return <MessageList messages={messages} isLoading={isLoading} spinnerLabel={agentStatus ?? undefined} />;
  };

  return (
    <Box flexDirection="column" height={process.stdout.rows}>
      <Header model={currentModel} mode={currentMode} />

      {mainContent()}

      {error && !overlay && (
        <Box paddingX={2}>
          <Text color={theme.error}>✖ {error}</Text>
        </Box>
      )}

      <InputArea
        onSubmit={handleAsk}
        isDisabled={isLoading || overlay !== null}
      />
      <StatusBar />
    </Box>
  );
}
