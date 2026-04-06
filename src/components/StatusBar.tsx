import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export function StatusBar() {
  return (
    <Box
      paddingX={2}
      borderStyle="single"
      borderColor={theme.border}
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    >
      <Text color={theme.sky} bold>/</Text>
      <Text color={theme.textMuted}>mode  </Text>
      <Text color={theme.sky} bold>/</Text>
      <Text color={theme.textMuted}>model  </Text>
      <Text color={theme.sky} bold>/</Text>
      <Text color={theme.textMuted}>new  </Text>
      <Text color={theme.sky} bold>/</Text>
      <Text color={theme.textMuted}>quit  </Text>
      <Text color={theme.bgAccent}>│  </Text>
      <Text color={theme.textMuted} dimColor>Tab to autocomplete</Text>
    </Box>
  );
}
