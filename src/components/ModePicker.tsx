import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import type { SearchMode } from '../types.js';

interface Props {
  modes: SearchMode[];
  current: SearchMode | null;
  onSelect: (mode: SearchMode) => void;
  onCancel: () => void;
}

export function ModePicker({ modes, current, onSelect, onCancel }: Props) {
  const [idx, setIdx] = useState(() =>
    Math.max(0, modes.findIndex((m) => m.id === current?.id)),
  );

  useInput((_char, key) => {
    if (key.upArrow)   { setIdx((i) => (i - 1 + modes.length) % modes.length); return; }
    if (key.downArrow) { setIdx((i) => (i + 1) % modes.length); return; }
    if (key.return)    { onSelect(modes[idx]); return; }
    if (key.escape)    { onCancel(); return; }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.sky}
      paddingX={2}
      paddingY={1}
    >
      <Text color={theme.sky} bold>  Search Mode</Text>
      <Text color={theme.border}>{'─'.repeat(44)}</Text>

      {modes.map((m, i) => {
        const isSelected = i === idx;
        const isCurrent  = m.id === current?.id;

        return (
          <Box key={m.id} flexDirection="row">
            <Text color={isSelected ? theme.sky : theme.text} bold={isSelected}>
              {isSelected ? '› ' : '  '}
              {m.icon}  {m.name}
            </Text>
            <Box flexGrow={1} />
            <Text color={theme.textMuted} dimColor>  {m.description}</Text>
            {isCurrent && <Text color={theme.textMuted} dimColor>  ← active</Text>}
            {m.isPro && <Text color={theme.locked}> PRO</Text>}
          </Box>
        );
      })}

      <Text color={theme.border}>{'─'.repeat(44)}</Text>
      <Text color={theme.textMuted} dimColor>↑↓ navigate  Enter select  Esc cancel</Text>
    </Box>
  );
}
