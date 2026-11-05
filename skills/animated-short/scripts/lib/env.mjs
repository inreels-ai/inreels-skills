// Loads keys from the environment, or from a .env file if one is given.
// The skill never ships keys; the user brings their own.
import fs from 'node:fs';

export function loadEnv(file) {
  if (file && fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '');
    }
  }
}

export function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Put it in your environment or pass --env <file>.`);
  return v;
}
