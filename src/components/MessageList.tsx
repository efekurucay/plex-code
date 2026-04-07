import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import { Message } from './Message.js';
import { Spinner } from './Spinner.js';
import type { Message as Msg } from '../types.js';

interface Props {
  messages: Msg[];
  isLoading: boolean;
  /** Optional label override for the spinner (e.g. agentic tool status). */
  spinnerLabel?: string;
}

const EMPTY_HINT = `  Type a message and press Enter to search with Perplexity.
  Press ${'\x1b[1m'}/\x1b[0m for commands  ·  ${'\x1b[1m'}/agent\x1b[0m to enable codebase mode  ·  ${'\x1b[1m'}Ctrl+M\x1b[0m for models.`;

export function MessageList({ messages, isLoading, spinnerLabel }: Props) {
  const cols = process.stdout.columns || 80;

  if (messages.length === 0 && !isLoading) {
    return (
      <Box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        <Text color={theme.primary} bold>
          {'  ✦ ✧ ✦  '}
        </Text>
        <Text color={theme.bgAccent}>{'─'.repeat(Math.min(cols - 4, 40))}</Text>
        <Text color={theme.textMuted}>{EMPTY_HINT}</Text>
      </Box>
    );
  }

  return (
    <Box flexGrow={1} flexDirection="column" overflow="hidden">
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}
      {isLoading && (
        <Box paddingX={2} marginTop={1}>
          <Spinner label={spinnerLabel} />
        </Box>
      )}
    </Box>
  );
}
