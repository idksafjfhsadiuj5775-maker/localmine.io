import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const WORLD_DIR = path.join(DATA_DIR, 'world');
const PLAYERS_DIR = path.join(DATA_DIR, 'players');

for (const d of [DATA_DIR, WORLD_DIR, PLAYERS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ---- World persistence ----
export function saveChunk(cx, cz, data) {
  const file = path.join(WORLD_DIR, `${cx},${cz}.bin`);
  fs.writeFileSync(file, Buffer.from(data));
}

export function loadChunkData(cx, cz) {
  const file = path.join(WORLD_DIR, `${cx},${cz}.bin`);
  if (!fs.existsSync(file)) return null;
  return new Uint8Array(fs.readFileSync(file));
}

export function chunkExists(cx, cz) {
  return fs.existsSync(path.join(WORLD_DIR, `${cx},${cz}.bin`));
}

// ---- Player persistence ----
export function savePlayer(username, data) {
  const file = path.join(PLAYERS_DIR, `${username}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function loadPlayer(username) {
  const file = path.join(PLAYERS_DIR, `${username}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function deletePlayer(username) {
  const file = path.join(PLAYERS_DIR, `${username}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
