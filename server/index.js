import express from 'express';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { Server } from 'socket.io';
import { World, B } from './world.js';
import { checkRecipe } from './recipes.js';
import { registerUser, loginUser, verifyToken } from './db.js';
import { saveChunk, loadChunkData, chunkExists, savePlayer, loadPlayer } from './save.js';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const world = new World(42);

// ---- Server creation (mode-dependent) ----
const embedded = process.env.ELECTRON_EMBEDDED === 'true';

let io;
let appServer; // the server that serves express + socket.io

if (embedded) {
  appServer = createServer(app);
  io = new Server(appServer);
} else {
  const redirectSrv = createServer((req, res) => {
    const host = req.headers.host?.split(':')[0] || 'localmine.io';
    res.writeHead(301, { Location: `https://${host}:3443${req.url}` });
    res.end();
  });
  const sslKey = readFileSync(join(__dirname, '..', 'ssl', 'key.pem'));
  const sslCert = readFileSync(join(__dirname, '..', 'ssl', 'cert.pem'));
  appServer = createHttpsServer({ key: sslKey, cert: sslCert }, app);
  io = new Server(appServer);
  redirectSrv.listen(3000, '0.0.0.0', () => {
    console.log(`HTTP redirect on http://0.0.0.0:3000 -> https://localmine.io:3443`);
  });
}

app.use(express.static('public'));
app.use(express.json());

// ---- Auth routes ----
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  const result = registerUser(username, password);
  res.json(result);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const result = loginUser(username, password);
  if (result.ok) {
    // Return user data for game initialisation too
    const playerData = loadPlayer(result.username) || null;
    res.json({ ...result, playerData });
  } else {
    res.json(result);
  }
});

app.post('/api/verify', (req, res) => {
  const { token } = req.body;
  const result = verifyToken(token);
  res.json(result);
});

// ---- Game state ----
const players = new Map();
const VIEW_DIST = 4;
let gameTime = 0;

setInterval(() => {
  gameTime = (gameTime + 0.1) % 24000;
  io.emit('timeUpdate', gameTime);
}, 50);

// ---- World persistence ----
// Override world's getOrGenerate to check disk first
const origGen = world.getOrGenerate.bind(world);
world.getOrGenerate = (cx, cz) => {
  const key = `${cx},${cz}`;
  if (world.chunks.has(key)) return world.chunks.get(key);
  const saved = loadChunkData(cx, cz);
  if (saved) {
    world.chunks.set(key, saved);
    return saved;
  }
  const chunk = origGen(cx, cz);
  saveChunk(cx, cz, chunk);
  return chunk;
};

const origSet = world.setBlock.bind(world);
world.setBlock = (gx, gy, gz, type) => {
  origSet(gx, gy, gz, type);
  const cx = Math.floor(gx / 16), cz = Math.floor(gz / 16);
  const chunk = world.chunks.get(`${cx},${cz}`);
  if (chunk) saveChunk(cx, cz, chunk);
};

// ---- Player helpers ----
function createInventory() {
  const inv = new Array(45).fill(null);
  inv[0] = { type: B.OAK_PLANKS, count: 16 };
  inv[1] = { type: B.COBBLESTONE, count: 16 };
  inv[2] = { type: B.DIRT, count: 16 };
  inv[3] = { type: B.STONE, count: 16 };
  inv[4] = { type: B.SAND, count: 16 };
  inv[5] = { type: B.OAK_LOG, count: 16 };
  inv[6] = { type: B.GRAVEL, count: 16 };
  inv[7] = { type: B.COAL_ORE, count: 16 };
  inv[8] = { type: B.GRASS, count: 16 };
  return inv;
}

function addToInventory(inv, type, count) {
  for (let i = 0; i < inv.length; i++) {
    if (inv[i] && inv[i].type === type) {
      const space = 64 - inv[i].count;
      const add = Math.min(space, count);
      inv[i].count += add; count -= add;
      if (count <= 0) return 0;
    }
  }
  for (let i = 0; i < inv.length; i++) {
    if (!inv[i]) {
      const add = Math.min(64, count);
      inv[i] = { type, count: add }; count -= add;
      if (count <= 0) return 0;
    }
  }
  return count;
}

function removeFromInventory(inv, type, count) {
  for (let i = 0; i < inv.length; i++) {
    if (inv[i] && inv[i].type === type) {
      const remove = Math.min(inv[i].count, count);
      inv[i].count -= remove; count -= remove;
      if (inv[i].count <= 0) inv[i] = null;
      if (count <= 0) return 0;
    }
  }
  return count;
}

function hasInInventory(inv, type, count) {
  let total = 0;
  for (const slot of inv) {
    if (slot && slot.type === type) total += slot.count;
    if (total >= count) return true;
  }
  return false;
}

function sendInventory(socket, inv) { socket.emit('inventory', inv); }

function getSpawn() {
  for (let gx = 0; gx < 20; gx++) {
    for (let gz = 0; gz < 20; gz++) {
      for (let y = 60; y >= 0; y--) {
        const b = world.getBlock(gx, y, gz);
        if (b !== 0 && y < 58) return { x: gx + 0.5, y: y + 2, z: gz + 0.5 };
      }
    }
  }
  return { x: 0.5, y: 10, z: 0.5 };
}

// ---- Socket events ----
io.on('connection', (socket) => {
  const authToken = socket.handshake.query?.token || null;
  let username = null;
  if (authToken) {
    const result = verifyToken(authToken);
    if (result.ok) username = result.username;
  }

  const spawn = getSpawn();
  let inv = createInventory();
  let health = 20;
  let pos = { x: spawn.x, y: spawn.y, z: spawn.z };

  if (username) {
    const saved = loadPlayer(username);
    if (saved) {
      inv = saved.inventory || inv;
      health = saved.health || 20;
      pos = saved.position || pos;
    }
  }

  const player = {
    id: socket.id,
    x: pos.x, y: pos.y, z: pos.z,
    rx: 0, ry: 0, health, maxHealth: 20,
    inventory: inv, fallStart: null,
    username, _sentChunks: new Set(),
  };

  players.set(socket.id, player);

  socket.emit('init', {
    id: socket.id,
    username,
    players: [...players.values()].map(p => ({
      id: p.id, x: p.x, y: p.y, z: p.z, rx: p.rx, ry: p.ry,
    })),
    time: gameTime,
  });

  sendInventory(socket, inv);
  socket.emit('health', player.health);

  const scx = Math.floor(pos.x / 16), scz = Math.floor(pos.z / 16);
  for (let dx = -VIEW_DIST; dx <= VIEW_DIST; dx++) {
    for (let dz = -VIEW_DIST; dz <= VIEW_DIST; dz++) {
      const key = `${scx + dx},${scz + dz}`;
      player._sentChunks.add(key);
      const cd = world.getChunkData(scx + dx, scz + dz);
      socket.emit('chunk', cd);
    }
  }

  socket.broadcast.emit('playerJoin', {
    id: socket.id, x: pos.x, y: pos.y, z: pos.z, rx: 0, ry: 0,
  });

  // ---- Auto-save every 30 seconds ----
  const autoSave = setInterval(() => {
    if (player.username) {
      savePlayer(player.username, {
        inventory: player.inventory,
        health: player.health,
        position: { x: player.x, y: player.y, z: player.z },
        lastSeen: Date.now(),
      });
    }
  }, 30000);

  socket.on('move', (data) => {
    const p = player;
    if (p.fallStart === null && data.vy < -0.5) p.fallStart = p.y;
    if (p.fallStart !== null && (data.onGround || data.vy >= 0)) {
      const fallDist = p.fallStart - data.y;
      if (fallDist > 3) {
        const dmg = Math.floor(fallDist - 3) * 2;
        if (dmg > 0) {
          p.health = Math.max(0, p.health - dmg);
          socket.emit('health', p.health);
          if (p.health <= 0) {
            const respawn = getSpawn();
            p.x = respawn.x; p.y = respawn.y; p.z = respawn.z;
            p.health = 20;
            socket.emit('health', p.health);
            socket.emit('respawn', respawn);
            io.emit('playerMove', { id: socket.id, x: respawn.x, y: respawn.y, z: respawn.z, rx: 0, ry: 0 });
          }
        }
      }
      p.fallStart = null;
    }
    p.x = data.x; p.y = data.y; p.z = data.z;
    p.rx = data.rx; p.ry = data.ry;
    socket.broadcast.emit('playerMove', { id: socket.id, x: data.x, y: data.y, z: data.z, rx: data.rx, ry: data.ry });

    const cx = Math.floor(data.x / 16), cz = Math.floor(data.z / 16);
    for (let dx = -VIEW_DIST; dx <= VIEW_DIST; dx++) {
      for (let dz = -VIEW_DIST; dz <= VIEW_DIST; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        if (!player._sentChunks.has(key)) {
          player._sentChunks.add(key);
          const cd = world.getChunkData(cx + dx, cz + dz);
          socket.emit('chunk', cd);
        }
      }
    }
  });

  socket.on('blockDestroy', ({ x, y, z }) => {
    const b = world.getBlock(x, y, z);
    if (b === 0) return;
    const leftover = addToInventory(player.inventory, b, 1);
    if (leftover > 0) return;
    world.setBlock(x, y, z, 0);
    io.emit('blockUpdate', { x, y, z, type: 0 });
    sendInventory(socket, player.inventory);
  });

  socket.on('blockPlace', ({ x, y, z, type }) => {
    if (type < 1 || type > 50) return;
    if (Math.abs(x) > 300 || Math.abs(z) > 300 || y < 0 || y > 60) return;
    if (world.getBlock(x, y, z) !== 0) return;
    if (!hasInInventory(player.inventory, type, 1)) return;
    removeFromInventory(player.inventory, type, 1);
    world.setBlock(x, y, z, type);
    io.emit('blockUpdate', { x, y, z, type });
    sendInventory(socket, player.inventory);
  });

  socket.on('invMove', ({ from, to }) => {
    const inv = player.inventory;
    if (from < 0 || from >= inv.length || to < 0 || to >= inv.length) return;
    const tmp = inv[from]; inv[from] = inv[to]; inv[to] = tmp;
    sendInventory(socket, inv);
  });

  socket.on('invSplit', ({ from }) => {
    const inv = player.inventory;
    if (!inv[from] || inv[from].count <= 1) return;
    let empty = -1;
    for (let i = 0; i < inv.length; i++) { if (!inv[i]) { empty = i; break; } }
    if (empty < 0) return;
    const half = Math.floor(inv[from].count / 2);
    inv[empty] = { type: inv[from].type, count: half };
    inv[from].count -= half;
    sendInventory(socket, inv);
  });

  socket.on('checkCraft', ({ grid }) => {
    socket.emit('craftResult', checkRecipe(grid));
  });

  socket.on('craft', ({ grid }) => {
    const result = checkRecipe(grid);
    if (!result) return;
    const inv = player.inventory;
    const needs = {};
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        const id = grid[y][x];
        if (id !== 0) needs[id] = (needs[id] || 0) + 1;
      }
    for (let i = 36; i < 40; i++) {
      const slot = inv[i];
      if (!slot) continue;
      const need = needs[slot.type];
      if (need) {
        const remove = Math.min(slot.count, need);
        slot.count -= remove; needs[slot.type] -= remove;
        if (slot.count <= 0) inv[i] = null;
        if (needs[slot.type] <= 0) delete needs[slot.type];
      }
    }
    addToInventory(inv, result.type, result.count);
    sendInventory(socket, inv);
  });

  socket.on('requestChunk', ({ cx, cz }) => {
    socket.emit('chunk', world.getChunkData(cx, cz));
  });

  socket.on('disconnect', () => {
    clearInterval(autoSave);
    if (player.username) {
      savePlayer(player.username, {
        inventory: player.inventory,
        health: player.health,
        position: { x: player.x, y: player.y, z: player.z },
        lastSeen: Date.now(),
      });
    }
    players.delete(socket.id);
    io.emit('playerLeave', socket.id);
  });
});

// ---- Save world on shutdown ----
function shutdown() {
  console.log('\nSaving world...');
  for (const [key, chunk] of world.chunks) {
    const [cx, cz] = key.split(',').map(Number);
    saveChunk(cx, cz, chunk);
  }
  console.log('World saved. Goodbye!');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (embedded) {
  const PORT = process.env.EMBEDDED_PORT || 3001;
  appServer.listen(PORT, '127.0.0.1', () => {
    console.log(`Embedded server ready on http://127.0.0.1:${PORT}`);
    if (process.send) process.send('server-ready');
  });
} else {
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

  appServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS server on https://0.0.0.0:${HTTPS_PORT}`);
    console.log(`Play at: https://localmine.io:${HTTPS_PORT}`);
  });
}
