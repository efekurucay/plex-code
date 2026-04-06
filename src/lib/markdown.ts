import chalk from 'chalk';

/** Render a markdown string to terminal-friendly ANSI text. */
export function renderMarkdown(text: string): string {
  // Fenced code blocks
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const header = lang
      ? chalk.hex('#20808D').bold(` ${lang} `) + '\n'
      : '';
    const body = code
      .split('\n')
      .map((l) => chalk.hex('#2E5E5A')('│ ') + chalk.hex('#E4E3D4')(l))
      .join('\n');
    const rule = chalk.hex('#2E5E5A')('─'.repeat(52));
    return `\n${header}${rule}\n${body}\n${rule}\n`;
  });

  // Inline code
  text = text.replace(/`([^`]+)`/g, (_m, code: string) =>
    chalk.bgHex('#153B39').hex('#20808D')(` ${code} `),
  );

  // H1
  text = text.replace(/^# (.+)$/gm, (_m, h: string) =>
    chalk.bold.underline.hex('#20808D')(`\n${h}\n`),
  );
  // H2
  text = text.replace(/^## (.+)$/gm, (_m, h: string) =>
    chalk.bold.hex('#20808D')(`\n${h}`),
  );
  // H3
  text = text.replace(/^### (.+)$/gm, (_m, h: string) =>
    chalk.hex('#67B8C0').bold(`  ${h}`),
  );

  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, (_m, b: string) => chalk.bold(b));
  // Italic
  text = text.replace(/\*(.+?)\*/g, (_m, i: string) => chalk.italic(i));

  // Unordered list
  text = text.replace(/^[*-] (.+)$/gm, (_m, b: string) =>
    chalk.hex('#20808D')('  •') + ` ${b}`,
  );
  // Numbered list
  text = text.replace(/^(\d+)\. (.+)$/gm, (_m, n: string, b: string) =>
    chalk.hex('#20808D')(`  ${n}.`) + ` ${b}`,
  );

  // Links — show text, drop URL
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, (_m, linkText: string) =>
    chalk.underline.hex('#67B8C0')(linkText),
  );

  return text;
}

/** Wrap text to given width without breaking ANSI codes. */
export function wrapText(text: string, width: number): string {
  return text
    .split('\n')
    .map((line) => {
      if (line.length <= width) return line;
      const words = line.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        if ((current + ' ' + word).trim().length > width) {
          if (current) lines.push(current);
          current = word;
        } else {
          current = (current + ' ' + word).trim();
        }
      }
      if (current) lines.push(current);
      return lines.join('\n');
    })
    .join('\n');
}
