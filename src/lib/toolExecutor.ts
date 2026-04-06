import { execSync } from 'child_process';

/** Commands explicitly allowed — read-only, no mutations. */
export const ALLOWED_COMMANDS = new Set([
  'cat', 'ls', 'head', 'tail', 'grep',
  'find', 'wc', 'pwd', 'file', 'tree',
  'echo', 'stat', 'basename', 'dirname',
]);

/** Max bytes of tool output to feed back to Perplexity. */
const MAX_OUTPUT_CHARS = 4_000;

/** Timeout for a single tool execution (ms). */
const EXEC_TIMEOUT_MS = 5_000;

/**
 * Validates and executes a whitelisted shell command.
 * Always returns a string — never throws.
 */
export async function executeTool(command: string): Promise<string> {
  // Extract the base command (first whitespace-delimited token)
  const trimmed = command.trim();
  const baseCmd  = trimmed.split(/\s+/)[0] ?? '';

  if (!ALLOWED_COMMANDS.has(baseCmd)) {
    return `[BLOCKED] '${baseCmd}' is not in the allowed command list. ` +
           `Allowed: ${[...ALLOWED_COMMANDS].join(', ')}.`;
  }

  // Sanity-check for obvious shell injection characters
  const DANGEROUS = /[;&|`$(){}[\]<>\\]/;
  // Allow: cat, ls, grep with flags/paths — but block semicolons, pipes etc.
  // We permit a single shell argument list; no chaining.
  // Exception: grep -rn patterns containing these chars are NOT supported.
  if (DANGEROUS.test(trimmed)) {
    // Whitelist a safe subset of patterns:
    //   flags like -la, --color, paths with / and .
    //   grep patterns with simple chars (no `;|` etc.)
    return `[BLOCKED] Command contains potentially unsafe characters. ` +
           `Pipes, semicolons, and shell special characters are not allowed.`;
  }

  try {
    const raw = execSync(trimmed, {
      cwd: process.cwd(),
      timeout: EXEC_TIMEOUT_MS,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const output = typeof raw === 'string' ? raw : String(raw);
    if (output.length > MAX_OUTPUT_CHARS) {
      return output.slice(0, MAX_OUTPUT_CHARS) + '\n...[TRUNCATED]';
    }
    return output || '(empty output)';
  } catch (err: unknown) {
    if (err instanceof Error) {
      // execSync throws with stdout/stderr attached when exit code ≠ 0
      const execErr = err as Error & { stdout?: string; stderr?: string; code?: string };
      if (execErr.code === 'ETIMEDOUT') {
        return `[ERROR] Command timed out after ${EXEC_TIMEOUT_MS / 1000}s.`;
      }
      const combined = [execErr.stdout, execErr.stderr, execErr.message]
        .filter(Boolean)
        .join('\n')
        .slice(0, MAX_OUTPUT_CHARS);
      return `[ERROR] ${combined || 'Unknown error'}`;
    }
    return `[ERROR] ${String(err)}`;
  }
}
