import path from 'path';
import os from 'os';
import fs from 'fs';

const PLEX_DIR = path.join(os.homedir(), '.plexcode');
const CONFIG_FILE = path.join(PLEX_DIR, 'config.json');

interface PlexConfig {
  defaultModel: string;
  defaultMode: string;
  proxyPort: number;
}

const DEFAULTS: PlexConfig = {
  defaultModel: 'sonar',
  defaultMode: 'default',
  proxyPort: 8080,
};

function load(): PlexConfig {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) } as PlexConfig;
  } catch {
    return { ...DEFAULTS };
  }
}

function save(cfg: PlexConfig): void {
  fs.mkdirSync(PLEX_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function get<K extends keyof PlexConfig>(key: K): PlexConfig[K] {
  return load()[key];
}

function set<K extends keyof PlexConfig>(key: K, value: PlexConfig[K]): void {
  const cfg = load();
  cfg[key] = value;
  save(cfg);
}

export const config = { get, set, load, save, PLEX_DIR };
