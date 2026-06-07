import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
  if (!fs.existsSync(DB_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch { return {}; }
}

function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

const SALT_LEN = 32;

export function registerUser(username, password) {
  const users = loadUsers();
  const key = username.toLowerCase();
  if (users[key]) return { ok: false, error: 'Username already taken' };
  if (username.length < 2) return { ok: false, error: 'Username too short' };
  if (password.length < 3) return { ok: false, error: 'Password too short' };

  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const hash = hashPassword(password, salt);
  const token = crypto.randomBytes(32).toString('hex');

  users[key] = { username, salt, hash, token, created: Date.now() };
  saveUsers(users);
  return { ok: true, token, username };
}

export function loginUser(username, password) {
  const users = loadUsers();
  const key = username.toLowerCase();
  const user = users[key];
  if (!user) return { ok: false, error: 'User not found' };

  const hash = hashPassword(password, user.salt);
  if (hash !== user.hash) return { ok: false, error: 'Wrong password' };

  const token = crypto.randomBytes(32).toString('hex');
  user.token = token;
  saveUsers(users);
  return { ok: true, token, username: user.username };
}

export function verifyToken(token) {
  const users = loadUsers();
  for (const [key, user] of Object.entries(users)) {
    if (user.token === token) return { ok: true, username: user.username };
  }
  return { ok: false };
}

// Token-based session: just store in memory for game socket
const sessions = new Map();

export function createSession(username) {
  const sid = crypto.randomBytes(16).toString('hex');
  sessions.set(sid, { username, createdAt: Date.now() });
  return sid;
}

export function getSession(sid) {
  return sessions.get(sid) || null;
}
