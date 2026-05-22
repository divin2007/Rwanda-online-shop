import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

const parseEnvFile = (filePath: string): Record<string, string> => {
  if (!existsSync(filePath)) return {};

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce<Record<string, string>>((acc, rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return acc;

      const separator = line.indexOf('=');
      if (separator <= 0) return acc;

      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key) acc[key] = value;
      return acc;
    }, {});
};

const findEnvRoot = (startDir: string): string | null => {
  let current = startDir;

  while (true) {
    if (existsSync(join(current, '.env')) || existsSync(join(current, '.env.local'))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

const loadLocalEnvironment = () => {
  if (process.env.NODE_ENV === 'production') return;

  const envRoot = findEnvRoot(process.cwd());
  if (!envRoot) return;

  const fileValues = {
    ...parseEnvFile(join(envRoot, '.env')),
    ...parseEnvFile(join(envRoot, '.env.local')),
  };

  for (const [key, value] of Object.entries(fileValues)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadLocalEnvironment();
