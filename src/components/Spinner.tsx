import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// 1. Define custom symmetric frames resembling a spinning wireframe globe/pill
// The sequence morphs through box-drawing characters to simulate 3D rotation of a mesh.
const SPINNER_FRAMES = [
  " (─) ",
  " (┼) ",
  " (╪) ",
  " (╫) ",
  " (╬) ",
  " (╫) ",
  " (╪) ",
  " (┼) ",
];

interface RGB { r: number; g: number; b: number; }

// Simple interpolation helper
function interpolateColor(c1: RGB, c2: RGB, t: number): RGB {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
}

interface Props {
  label?: string;
  reducedMotion?: boolean;
}

// Convert hex to rgb object for the perplexity theme
// Dim: #2E5E5A -> 46, 94, 90 (Peacock / border)
// Bright: #67B8C0 -> 103, 184, 192 (Sky)
const DIM_COLOR: RGB = { r: 46, g: 94, b: 90 };
const BRIGHT_COLOR: RGB = { r: 103, g: 184, b: 192 };

export function Spinner({ label = 'Thinking...', reducedMotion = false }: Props) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      setTime(Date.now() - startTime);
    }, 50); // 50ms tick rate is smooth enough for terminal
    return () => clearInterval(interval);
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <Box>
        <Text color="#67B8C0">✦ {label}</Text>
      </Box>
    );
  }

  // Derive frame index purely from elapsed time (100ms per frame)
  const frame = Math.floor(time / 100) % SPINNER_FRAMES.length;
  const spinnerChar = SPINNER_FRAMES[frame];

  // Calculate color pulse using a sine wave (2-second period)
  const elapsedSec = time / 1000;
  const pulseFraction = (Math.sin(elapsedSec * Math.PI * 2 / 2) + 1) / 2; 

  const currentRgb = interpolateColor(DIM_COLOR, BRIGHT_COLOR, pulseFraction);
  const colorString = `rgb(${currentRgb.r},${currentRgb.g},${currentRgb.b})`;

  // Render using Ink's <Text> with dynamic rgb
  return (
    <Box>
      <Text color={colorString}>{spinnerChar} </Text>
      <Text color={colorString}>{label}</Text>
    </Box>
  );
}
