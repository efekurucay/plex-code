import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import type { Model } from '../types.js';

interface Props {
  models: Model[];
  current: Model;
  onSelect: (model: Model) => void;
  onCancel: () => void;
}

export function ModelPicker({ models, current, onSelect, onCancel }: Props) {
  const [idx, setIdx] = useState(() => models.findIndex((m) => m.id === current.id));

  useInput((_char, key) => {
    if (key.upArrow)    { setIdx((i) => (i - 1 + models.length) % models.length); return; }
    if (key.downArrow)  { setIdx((i) => (i + 1) % models.length); return; }
    if (key.return)     { onSelect(models[idx]); return; }
    if (key.escape)     { onCancel(); return; }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.primary}
      paddingX={2}
      paddingY={1}
    >
      <Text color={theme.primary} bold>  Select Model</Text>
      <Text color={theme.border}>{'─'.repeat(32)}</Text>

      {models.map((m, i) => {
        const isSelected = i === idx;
        const isCurrent  = m.id === current.id;

        return (
          <Box key={m.id}>
            <Text color={isSelected ? theme.primary : theme.text} bold={isSelected}>
              {isSelected ? '› ' : '  '}
              {m.icon} {m.name}
            </Text>
            {isCurrent && <Text color={theme.textMuted} dimColor>  ← current</Text>}
            {m.isMax  && <Text color={theme.locked}> MAX</Text>}
            {m.isPro  && !m.isMax && <Text color={theme.locked}> PRO</Text>}
            {m.hasThinking && isSelected && (
              <Text color={theme.sky}> ✦ thinking</Text>
            )}
          </Box>
        );
      })}

      <Text color={theme.border}>{'─'.repeat(32)}</Text>
      <Text color={theme.textMuted} dimColor>↑↓ navigate  Enter select  Esc cancel</Text>
    </Box>
  );
}
