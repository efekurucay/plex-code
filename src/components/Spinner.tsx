import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { theme } from '../theme.js';

const FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

interface Props {
  label?: string;
}

export function Spinner({ label = 'Thinking...' }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    return () => clearInterval(t);
  }, []);

  return (
    <Text color={theme.primary}>
      {FRAMES[frame]} {label}
    </Text>
  );
}
