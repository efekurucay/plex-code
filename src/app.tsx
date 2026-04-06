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

  const savedModelId = config.get('defaultModel');
  const [currentModel, setCurrentModel] = useState<Model>(
    () => MODELS.find((m) => m.id === savedModelId) ?? MODELS[0],
  );
  const savedModeId = config.get('defaultMode');
  const [currentMode, setCurrentMode]   = useState<SearchMode>(
    () => MODES.find((m) => m.id === savedModeId) ?? MODES[0],
  );

  const browser = useRef<PerplexityBrowser | null>(null);

  // Quit on Ctrl+C when no overlay active
  useInput((_char, key) => {
    if (key.ctrl && _char === 'c') exit();
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

  async function handleAsk(text: string) {
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

  return (
    <Box flexDirection="column" height={process.stdout.rows}>
      <Header model={currentModel} mode={currentMode} />

      {/* Overlays */}
      {overlay === 'model' && (
        <Box position="absolute" marginX={2} marginY={2}>
          <ModelPicker
            models={MODELS}
            current={currentModel}
            onSelect={handleModelSelect}
            onCancel={() => setOverlay(null)}
          />
        </Box>
      )}
      {overlay === 'mode' && (
        <Box position="absolute" marginX={2} marginY={2}>
          <ModePicker
            modes={MODES}
            current={currentMode}
            onSelect={handleModeSelect}
            onCancel={() => setOverlay(null)}
          />
        </Box>
      )}

      {/* Chat area */}
      <MessageList messages={messages} isLoading={isLoading} />

      {error && (
        <Box paddingX={2}>
          <Text color={theme.error}>✖ {error}</Text>
        </Box>
      )}

      <InputArea
        onSubmit={handleAsk}
        onModeOpen={() => setOverlay('mode')}
        onModelOpen={() => setOverlay('model')}
        onNewChat={() => setMessages([])}
        isDisabled={isLoading || overlay !== null}
      />
      <StatusBar />
    </Box>
  );
}
