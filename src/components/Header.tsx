import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import type { Model, SearchMode } from '../types.js';

interface Props {
  model: Model;
  mode: SearchMode | null;
}

export function Header({ model, mode }: Props) {
  const cols = process.stdout.columns || 80;
  const modeLabel = mode && mode.id !== 'default' ? mode.name : 'Search';

  return (
    <Box
      width={cols}
      paddingX={1}
      borderStyle="single"
      borderColor={theme.border}
      borderBottom={true}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
    >
      {/* Logo */}
      <Text color={theme.primary} bold>
        ✦ plexcode
      </Text>

      <Text color={theme.bgAccent}>  │  </Text>

      {/* Model */}
      <Text color={theme.textMuted}>model </Text>
      <Text color={theme.sky} bold>{model.name}</Text>
      {model.isPro && <Text color={theme.locked}> pro</Text>}
      {model.isMax && <Text color={theme.locked}> max</Text>}

      <Text color={theme.bgAccent}>  │  </Text>

      {/* Mode */}
      <Text color={theme.textMuted}>mode </Text>
      <Text color={theme.sky} bold>{modeLabel}</Text>

      <Box flexGrow={1} />

      <Text color={theme.textMuted} dimColor>ctrl+? help</Text>
    </Box>
  );
}
