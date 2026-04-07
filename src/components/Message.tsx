import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import { renderMarkdown } from '../lib/markdown.js';
import type { Message as Msg } from '../types.js';

interface Props {
  message: Msg;
}

export function Message({ message }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <Box marginTop={1} marginBottom={0} paddingX={1} flexDirection="column">
        <Box>
          <Text color={theme.user} bold>❯ </Text>
          <Text color={theme.user} wrap="wrap">{message.content}</Text>
        </Box>
      </Box>
    );
  }

  const rendered = renderMarkdown(message.content);
  // Split into lines and render each as its own <Text> block.
  // This prevents Ink from treating one giant string as a single flow element,
  // which causes lines to bleed into each other when the terminal wraps them.
  const lines = rendered.split('\n');

  return (
    <Box marginY={1} paddingX={1} flexDirection="column">
      {/* AI header row */}
      <Box marginBottom={0}>
        <Text color={theme.primary} bold>✦ </Text>
        <Text color={theme.primary} bold>Perplexity</Text>
        {message.model && (
          <Text color={theme.textMuted} dimColor>
            {' '}({message.model})
          </Text>
        )}
        {message.mode && message.mode !== 'default' && (
          <Text color={theme.primaryDim} dimColor>
            {' · '}{message.mode}
          </Text>
        )}
      </Box>

      {/* Response body — one <Text> per line to avoid wrap bleed */}
      <Box paddingLeft={2} flexDirection="column">
        {lines.map((line, i) => (
          <Text key={i} wrap="wrap">{line}</Text>
        ))}
      </Box>
    </Box>
  );
}
