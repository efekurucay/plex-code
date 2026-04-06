import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { Spinner } from './Spinner.js';

interface Props {
  onDone: () => void;
}

export function LoginScreen({ onDone }: Props) {
  const [step, setStep] = useState<'waiting' | 'saving'>('waiting');

  useInput((_char, key) => {
    if (key.return && step === 'waiting') {
      setStep('saving');
      onDone();
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1} paddingX={4}>
      {/* Logo */}
      <Text color={theme.primary} bold>
        {'\n  ✦ ✧ ✦  plexcode  ✦ ✧ ✦\n'}
      </Text>

      <Box borderStyle="round" borderColor={theme.primary} paddingX={3} paddingY={1} flexDirection="column">
        <Text color={theme.text} bold>Welcome to PlexCode</Text>
        <Text color={theme.textMuted}>{'─'.repeat(34)}</Text>
        <Text color={theme.textDim}>
          {'\n'}A browser window has opened so you can{'\n'}
          log in to your Perplexity account.{'\n'}
        </Text>
        <Text color={theme.textMuted}>
          1. Complete login in the browser{'\n'}
          2. Return here and press{' '}
          <Text color={theme.primary} bold>Enter</Text>
        </Text>
        <Text color={theme.textDim}>{'\n'}Your session will be saved for future runs.</Text>
      </Box>

      <Box marginTop={2}>
        {step === 'waiting' ? (
          <Text color={theme.sky}>
            {'  ── Press '}
            <Text bold>Enter</Text>
            {' after logging in ──'}
          </Text>
        ) : (
          <Spinner label="Saving session..." />
        )}
      </Box>
    </Box>
  );
}
