import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export function StatusBar() {
  const shortcuts = [
    ['/', 'mode'],
    ['Ctrl+M', 'model'],
    ['Ctrl+N', 'new chat'],
    ['Ctrl+C', 'quit'],
  ];

  return (
    <Box paddingX={1} borderStyle="single" borderColor={theme.border} borderTop borderBottom={false} borderLeft={false} borderRight={false}>
      {shortcuts.map(([key, label], i) => (
        <React.Fragment key={key}>
          {i > 0 && <Text color={theme.bgAccent}>  </Text>}
          <Text color={theme.primary} bold>{key}</Text>
          <Text color={theme.textMuted}> {label}</Text>
        </React.Fragment>
      ))}
    </Box>
  );
}
