import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

interface Props {
  onSubmit: (text: string) => void;
  onModeOpen: () => void;
  onModelOpen: () => void;
  onNewChat: () => void;
  isDisabled: boolean;
}

export function InputArea({ onSubmit, onModeOpen, onModelOpen, onNewChat, isDisabled }: Props) {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);

  useInput((char, key) => {
    if (isDisabled) return;

    if (key.return) {
      const trimmed = value.trim();
      if (trimmed) {
        onSubmit(trimmed);
        setValue('');
        setCursor(0);
      }
      return;
    }

    if (key.escape) {
      setValue('');
      setCursor(0);
      return;
    }

    if (key.backspace || key.delete) {
      if (cursor > 0) {
        setValue((v) => v.slice(0, cursor - 1) + v.slice(cursor));
        setCursor((c) => c - 1);
      }
      return;
    }

    if (key.leftArrow) { setCursor((c) => Math.max(0, c - 1)); return; }
    if (key.rightArrow) { setCursor((c) => Math.min(value.length, c + 1)); return; }

    if (key.ctrl) {
      if (char === 'm') { onModelOpen(); return; }
      if (char === 'n') { onNewChat(); return; }
      return;
    }

    if (char && !key.meta) {
      // Typing '/' on empty input → open mode picker
      if (char === '/' && value === '') {
        onModeOpen();
        return;
      }
      setValue((v) => v.slice(0, cursor) + char + v.slice(cursor));
      setCursor((c) => c + 1);
    }
  });

  const before = value.slice(0, cursor);
  const atCursor = value[cursor] ?? ' ';
  const after = value.slice(cursor + 1);

  return (
    <Box
      flexDirection="row"
      borderStyle="round"
      borderColor={isDisabled ? theme.border : theme.borderFocus}
      paddingX={1}
      marginX={0}
    >
      <Text color={isDisabled ? theme.textMuted : theme.primary} bold>❯ </Text>
      <Text color={theme.text}>{before}</Text>
      <Text backgroundColor={isDisabled ? theme.bgMuted : theme.primary} color={theme.bg}>
        {atCursor}
      </Text>
      <Text color={theme.text}>{after}</Text>
    </Box>
  );
}
