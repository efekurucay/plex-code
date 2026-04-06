import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

// ── Slash commands ───────────────────────────────────────────────────────────
export const SLASH_COMMANDS = [
  { cmd: '/mode',   desc: 'Change search mode'       },
  { cmd: '/model',  desc: 'Change AI model'           },
  { cmd: '/new',    desc: 'Start new conversation'    },
  { cmd: '/login',  desc: 'Log in to Perplexity'      },
  { cmd: '/quit',   desc: 'Exit plexcode'             },
  { cmd: '/logout', desc: 'Clear session & log out'   },
  { cmd: '/help',   desc: 'Show available commands'   },
] as const;

interface Props {
  onSubmit: (text: string) => void;
  isDisabled: boolean;
}

export function InputArea({ onSubmit, isDisabled }: Props) {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);

  const isSlash  = value.startsWith('/');
  const matches  = isSlash
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(value.toLowerCase()))
    : [];

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

    if (key.tab && matches.length === 1) {
      // Autocomplete single match
      setValue(matches[0].cmd);
      setCursor(matches[0].cmd.length);
      return;
    }

    if (key.backspace || key.delete) {
      if (cursor > 0) {
        setValue((v) => v.slice(0, cursor - 1) + v.slice(cursor));
        setCursor((c) => c - 1);
      }
      return;
    }

    if (key.leftArrow)  { setCursor((c) => Math.max(0, c - 1));          return; }
    if (key.rightArrow) { setCursor((c) => Math.min(value.length, c + 1)); return; }

    if (char && !key.ctrl && !key.meta) {
      setValue((v) => v.slice(0, cursor) + char + v.slice(cursor));
      setCursor((c) => c + 1);
    }
  });

  const before   = value.slice(0, cursor);
  const atCursor = value[cursor] ?? ' ';
  const after    = value.slice(cursor + 1);

  return (
    <Box flexDirection="column">
      {/* Autocomplete hints */}
      {isSlash && matches.length > 0 && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.sky}
          paddingX={2}
          paddingY={0}
          marginX={0}
        >
          {matches.map((m) => {
            const isExact = m.cmd === value.toLowerCase();
            return (
              <Box key={m.cmd}>
                <Text color={isExact ? theme.primary : theme.sky} bold={isExact}>
                  {m.cmd}
                </Text>
                <Text color={theme.textMuted}>{'  '}{m.desc}</Text>
              </Box>
            );
          })}
          {matches.length === 1 && (
            <Text color={theme.textMuted} dimColor>Tab to complete  Enter to run</Text>
          )}
        </Box>
      )}

      {/* Input box */}
      <Box
        flexDirection="row"
        borderStyle="round"
        borderColor={isDisabled ? theme.border : isSlash ? theme.sky : theme.borderFocus}
        paddingX={1}
      >
        <Text color={isDisabled ? theme.textMuted : isSlash ? theme.sky : theme.primary} bold>
          {isSlash ? '/' : '❯'}{' '}
        </Text>
        <Text color={theme.text}>{isSlash ? before.slice(1) : before}</Text>
        <Text backgroundColor={isDisabled ? theme.bgMuted : isSlash ? theme.sky : theme.primary} color={theme.bg}>
          {atCursor}
        </Text>
        <Text color={theme.text}>{after}</Text>
      </Box>
    </Box>
  );
}
