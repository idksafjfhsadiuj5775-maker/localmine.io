// ---- Three.js check ----
if (typeof THREE === 'undefined') {
  document.getElementById('blocker').innerHTML = `
    <div id="instructions">
      <h1>Failed to load 3D engine</h1>
      <p>Please check your internet connection or disable ad-blockers.</p>
      <button onclick="location.reload()" style="margin-top:16px;padding:8px 24px;font-size:16px;cursor:pointer;">Reload</button>
    </div>`;
  throw new Error('THREE not loaded');
}

// ---- Block registry ----
var B = {
  1: { color: 0x4CAF50, name: 'Grass' }, 2: { color: 0x795548, name: 'Dirt' },
  3: { color: 0x9E9E9E, name: 'Stone' }, 4: { color: 0x8D6E63, name: 'Cobblestone' },
  5: { color: 0xF4E4A0, name: 'Sand' }, 6: { color: 0x9E9E9E, name: 'Gravel' },
  7: { color: 0x5D4037, name: 'Oak Log' }, 8: { color: 0x2E7D32, name: 'Oak Leaves' },
  9: { color: 0xBCAAA4, name: 'Oak Planks' }, 10: { color: 0x212121, name: 'Coal Ore' },
  11: { color: 0xD7A06E, name: 'Iron Ore' }, 12: { color: 0xFFD54F, name: 'Gold Ore' },
  13: { color: 0x4FC3F7, name: 'Diamond Ore' }, 14: { color: 0x111111, name: 'Bedrock' },
  15: { color: 0xFFFFFF, name: 'Snow' }, 16: { color: 0xD4C5A0, name: 'Sandstone' },
  17: { color: 0x9933CC, name: 'Obsidian' }, 18: { color: 0x4E342E, name: 'Spruce Log' },
  19: { color: 0x1B5E20, name: 'Spruce Leaves' }, 20: { color: 0xD7CCC8, name: 'Birch Log' },
  21: { color: 0x66BB6A, name: 'Birch Leaves' }, 23: { color: 0x8B0000, name: 'Netherrack' },
  24: { color: 0xFFD700, name: 'Glowstone' }, 25: { color: 0xBDBDBD, name: 'Stone Bricks' },
  26: { color: 0x7CB342, name: 'Mossy Cobble' }, 27: { color: 0x616161, name: 'Deepslate' },
  28: { color: 0x757575, name: 'Cobbled Deepslate' }, 29: { color: 0x5D4037, name: 'Mud' },
  30: { color: 0x6D4C41, name: 'Packed Mud' }, 31: { color: 0x8D6E63, name: 'Mud Bricks' },
  32: { color: 0xBDBDBD, name: 'Tuff' }, 33: { color: 0xF5E6D3, name: 'Calcite' },
  34: { color: 0xE65100, name: 'Magma' }, 35: { color: 0xD4C5A0, name: 'End Stone' },
  36: { color: 0xCE93D8, name: 'Purpur' }, 37: { color: 0x6D4C41, name: 'Coarse Dirt' },
  38: { color: 0x558B2F, name: 'Podzol' }, 39: { color: 0x7B1FA2, name: 'Mycelium' },
  40: { color: 0xE57373, name: 'Red Sand' }, 41: { color: 0xEF9A9A, name: 'Red Sandstone' },
  42: { color: 0xFFD700, name: 'Gold Block' }, 43: { color: 0xE0E0E0, name: 'Iron Block' },
  44: { color: 0x4FC3F7, name: 'Diamond Block' }, 45: { color: 0x212121, name: 'Netherite Block' },
  46: { color: 0x8D6E63, name: 'Brick' }, 47: { color: 0x7CB342, name: 'Mossy Stone Bricks' },
};

// ---- Pointer lock setup (immediate) ----
var blocker = document.getElementById('blocker');
if (blocker) {
  blocker.addEventListener('click', function() {
    var c = document.querySelector('canvas');
    if (c) c.requestPointerLock();
    else blocker.requestPointerLock();
  });
}

document.addEventListener('pointerlockchange', function() {
  var locked = document.pointerLockElement === document.querySelector('canvas');
  if (blocker) blocker.style.display = locked ? 'none' : 'flex';
});

// ---- Constants ----
var CS = 16, CH = 64, VD = 4, GRAV = -20, JV = 7, SPD = 5, REACH = 6, EYE = 1.6;

// ---- State ----
var vel = new THREE.Vector3();
var onGround = false, selHot = 0, locked = false, invOpen = false;
var keys = {}, chunks = new Map(), inventory = new Array(45).fill(null);
var health = 20, dragSlot = null, localId = null;
var euler = new THREE.Euler(0, 0, 0, 'YXZ'), PI_2 = Math.PI / 2;

// ---- Scene ----
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 48, 72);

var camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 150);
camera.position.set(0, 12, 0);

var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);

var sun = new THREE.DirectionalLight(0xffeedd, 1.2);
sun.position.set(80, 100, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 150;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
scene.add(sun);

var ambient = new THREE.AmbientLight(0x8899cc, 0.45);
scene.add(ambient);

var hemi = new THREE.HemisphereLight(0x87CEEB, 0x3e7a3e, 0.5);
scene.add(hemi);

// ---- Block helpers ----
function getBlock(gx, gy, gz) {
  var cx = Math.floor(gx / CS), cz = Math.floor(gz / CS);
  var lx = ((gx % CS) + CS) % CS, lz = ((gz % CS) + CS) % CS;
  var chunk = chunks.get(cx + ',' + cz);
  if (!chunk) return 0;
  if (gy < 0 || gy >= CH) return 0;
  return chunk.blocks[lx + lz * CS + gy * CS * CS] || 0;
}

// ---- Chunk rendering ----
function buildChunkMesh(blocks) {
  var groups = {};
  for (var y = 0; y < CH; y++)
    for (var z = 0; z < CS; z++)
      for (var x = 0; x < CS; x++) {
        var t = blocks[x + z * CS + y * CS * CS];
        if (t === 0) continue;
        if (!groups[t]) groups[t] = [];
        groups[t].push({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      }

  var group = new THREE.Group();
  var geo = new THREE.BoxGeometry(1, 1, 1);
  for (var ts in groups) {
    var type = parseInt(ts), info = B[type];
    if (!info) continue;
    var mat = new THREE.MeshLambertMaterial({ color: info.color });
    var positions = groups[ts];
    var mesh = new THREE.InstancedMesh(geo, mat, positions.length);
    var m = new THREE.Matrix4();
    positions.forEach(function(p, i) {
      m.identity().setPosition(p.x, p.y, p.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}

function loadChunk(cx, cz, data) {
  var key = cx + ',' + cz;
  var old = chunks.get(key);
  if (old) {
    scene.remove(old.group);
    old.group.traverse(function(c) { if (c.isInstancedMesh) { c.geometry.dispose(); c.material.dispose(); } });
  }
  var blocks;
  if (data instanceof ArrayBuffer) { blocks = new Uint8Array(data); }
  else if (data.buffer instanceof ArrayBuffer) { blocks = new Uint8Array(data.buffer, data.byteOffset, data.byteLength); }
  else { console.warn('Unknown chunk data type'); return; }

  var group = buildChunkMesh(blocks);
  group.position.set(cx * CS, 0, cz * CS);
  scene.add(group);
  chunks.set(key, { blocks: blocks, group: group });
}

// ---- DDA raycast ----
function raycastVoxels(ox, oy, oz, dx, dy, dz, maxD) {
  var x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  var tdX = Math.abs(1 / dx), tdY = Math.abs(1 / dy), tdZ = Math.abs(1 / dz);
  var tmX = dx > 0 ? (x + 1 - ox) / dx : (ox - x) / -dx;
  var tmY = dy > 0 ? (y + 1 - oy) / dy : (oy - y) / -dy;
  var tmZ = dz > 0 ? (z + 1 - oz) / dz : (oz - z) / -dz;
  var px = x, py = y, pz = z;
  for (var i = 0; i < maxD * 3; i++) {
    if (getBlock(x, y, z)) return { x: x, y: y, z: z, px: px, py: py, pz: pz };
    px = x; py = y; pz = z;
    if (tmX < tmY) { if (tmX > maxD) break; x += sx; tmX += tdX; }
    else if (tmY < tmZ) { if (tmY > maxD) break; y += sy; tmY += tdY; }
    else { if (tmZ > maxD) break; z += sz; tmZ += tdZ; }
  }
  return null;
}

// ---- Player physics ----
function updatePlayer(dt) {
  var fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  fwd.y = 0; fwd.normalize();
  var right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  right.y = 0; right.normalize();

  var dir = new THREE.Vector3();
  if (keys['w'] || keys['W']) dir.add(fwd);
  if (keys['s'] || keys['S']) dir.sub(fwd);
  if (keys['a'] || keys['A']) dir.sub(right);
  if (keys['d'] || keys['D']) dir.add(right);
  if (dir.length() > 0) dir.normalize();

  var nx = Math.floor(camera.position.x + dir.x * SPD * dt);
  var nz = Math.floor(camera.position.z + dir.z * SPD * dt);
  var fy = Math.floor(camera.position.y - EYE);

  if (!getBlock(nx, fy, Math.floor(camera.position.z)) && !getBlock(nx, fy + 1, Math.floor(camera.position.z)))
    camera.position.x += dir.x * SPD * dt;
  if (!getBlock(Math.floor(camera.position.x), fy, nz) && !getBlock(Math.floor(camera.position.x), fy + 1, nz))
    camera.position.z += dir.z * SPD * dt;

  vel.y += GRAV * dt;
  camera.position.y += vel.y * dt;

  var gy = Math.floor(camera.position.y - EYE);
  if (camera.position.y - EYE < gy + 1 && getBlock(Math.floor(camera.position.x), gy, Math.floor(camera.position.z))) {
    camera.position.y = gy + 1 + EYE;
    if (vel.y < 0) vel.y = 0;
    onGround = true;
  } else onGround = false;

  if ((keys[' '] || keys['Space']) && onGround) { vel.y = JV; onGround = false; }

  socket.emit('move', {
    x: camera.position.x, y: camera.position.y, z: camera.position.z,
    rx: euler.x, ry: euler.y, vy: vel.y, onGround: onGround,
  });
}

// ---- HUD ----
function updateHUD() {
  var bar = document.getElementById('health-bar');
  bar.innerHTML = '';
  for (var i = 0; i < 10; i++) {
    var h = document.createElement('div');
    h.className = 'heart';
    if (health >= (i + 1) * 2) h.className = 'heart';
    else if (health >= i * 2 + 1) h.className = 'heart half';
    else h.className = 'heart empty';
    bar.appendChild(h);
  }

  var hbar = document.getElementById('hotbar');
  hbar.innerHTML = '';
  for (var i = 0; i < 9; i++) {
    var slot = document.createElement('div');
    slot.className = 'slot' + (i === selHot ? ' active' : '');
    var item = inventory[i];
    if (item && B[item.type]) {
      var box = document.createElement('div');
      box.className = 'color-box';
      box.style.background = '#' + B[item.type].color.toString(16).padStart(6, '0');
      slot.appendChild(box);
      if (item.count > 1) {
        var cnt = document.createElement('span');
        cnt.className = 'count'; cnt.textContent = item.count;
        slot.appendChild(cnt);
      }
    }
    hbar.appendChild(slot);
  }
}

// ---- Inventory ----
function toggleInventory() {
  invOpen = !invOpen;
  document.getElementById('inventory-screen').style.display = invOpen ? 'flex' : 'none';
  if (invOpen) renderInv();
  if (!invOpen && document.pointerLockElement !== renderer.domElement && locked)
    renderer.domElement.requestPointerLock();
}

function renderInv() {
  var slots = document.getElementById('inv-slots');
  slots.innerHTML = '';
  for (var i = 9; i < 45; i++) slots.appendChild(mkSlot(i, inventory[i]));

  var hbar = document.getElementById('inv-hotbar');
  hbar.innerHTML = '';
  for (var i = 0; i < 9; i++) hbar.appendChild(mkSlot(i, inventory[i]));

  renderCraft();
  setTimeout(function() { checkCraft(); }, 50);
}

function mkSlot(idx, item) {
  var div = document.createElement('div');
  div.className = 'slot';
  div.dataset.idx = idx;
  if (item && B[item.type]) {
    var box = document.createElement('div');
    box.className = 'color-box';
    box.style.background = '#' + B[item.type].color.toString(16).padStart(6, '0');
    div.appendChild(box);
    if (item.count > 1) {
      var cnt = document.createElement('span');
      cnt.className = 'count'; cnt.textContent = item.count;
      div.appendChild(cnt);
    }
  }
  div.onmousedown = function(e) {
    if (e.button !== 0) return;
    var from = parseInt(this.dataset.idx);
    if (dragSlot !== null) {
      socket.emit('invMove', { from: dragSlot, to: from });
      dragSlot = null;
      document.getElementById('inv-container').style.cursor = '';
    } else if (inventory[from]) {
      if (e.shiftKey && inventory[from].count > 1) socket.emit('invSplit', { from: from });
      else { dragSlot = from; this.style.outline = '2px solid #fff'; document.getElementById('inv-container').style.cursor = 'grabbing'; }
    }
  };
  return div;
}

function renderCraft() {
  for (var i = 0; i < 4; i++) {
    var slot = document.querySelector('.craft-slot[data-idx="' + i + '"]');
    if (!slot) continue;
    var item = inventory[36 + i];
    slot.innerHTML = '';
    if (item && B[item.type]) {
      var box = document.createElement('div');
      box.className = 'color-box';
      box.style.background = '#' + B[item.type].color.toString(16).padStart(6, '0');
      slot.appendChild(box);
      if (item.count > 1) {
        var cnt = document.createElement('span'); cnt.className = 'count'; cnt.textContent = item.count;
        slot.appendChild(cnt);
      }
    }
    slot.onmousedown = function(e) {
      if (e.button !== 0) return;
      var idx = parseInt(this.dataset.idx);
      var invIdx = 36 + idx;
      if (dragSlot !== null) {
        socket.emit('invMove', { from: dragSlot, to: invIdx });
        dragSlot = null;
        document.getElementById('inv-container').style.cursor = '';
      } else if (inventory[invIdx]) {
        dragSlot = invIdx;
        this.style.outline = '2px solid #fff';
        document.getElementById('inv-container').style.cursor = 'grabbing';
      }
    };
  }
}

function checkCraft() {
  var grid = [];
  for (var y = 0; y < 2; y++) {
    var row = [];
    for (var x = 0; x < 2; x++) {
      var item = inventory[36 + y * 2 + x];
      row.push(item ? item.type : 0);
    }
    grid.push(row);
  }
  socket.emit('checkCraft', grid);
}

socket.on('craftResult', function(result) {
  var slot = document.getElementById('craft-result');
  slot.innerHTML = '';
  slot.className = 'craft-slot';
  if (result) {
    slot.classList.add('has-recipe');
    var box = document.createElement('div');
    box.className = 'color-box';
    box.style.background = '#' + (B[result.type] || {}).color.toString(16).padStart(6, '0') || '#888';
    slot.appendChild(box);
    var cnt = document.createElement('span'); cnt.className = 'count'; cnt.textContent = result.count;
    slot.appendChild(cnt);
    slot.dataset.result = JSON.stringify(result);
  } else delete slot.dataset.result;
});

document.getElementById('craft-result').onclick = function() {
  var slot = document.getElementById('craft-result');
  if (!slot.dataset.result) return;
  var result = JSON.parse(slot.dataset.result);
  var grid = [];
  for (var y = 0; y < 2; y++) {
    var row = [];
    for (var x = 0; x < 2; x++) {
      var item = inventory[36 + y * 2 + x];
      row.push(item ? item.type : 0);
    }
    grid.push(row);
  }
  socket.emit('craft', { grid: grid });
};

// ---- Input ----
document.addEventListener('keydown', function(e) {
  keys[e.key] = true;
  if (e.key === 'e' || e.key === 'E') toggleInventory();
  if (e.key === 'Escape' && invOpen) toggleInventory();
  var n = parseInt(e.key);
  if (n >= 1 && n <= 9 && !invOpen) { selHot = n - 1; updateHUD(); }
});
document.addEventListener('keyup', function(e) { keys[e.key] = false; });

document.addEventListener('mousemove', function(e) {
  if (!locked) return;
  euler.setFromQuaternion(camera.quaternion);
  euler.y -= e.movementX * 0.002;
  euler.x -= e.movementY * 0.002;
  euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
  camera.quaternion.setFromEuler(euler);
});

renderer.domElement.addEventListener('mousedown', function(e) {
  if (!locked || invOpen) return;
  if (e.button === 0) destroyBlock();
  else if (e.button === 2) placeBlock();
});
renderer.domElement.addEventListener('contextmenu', function(e) { e.preventDefault(); });

function destroyBlock() {
  var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  var hit = raycastVoxels(camera.position.x, camera.position.y, camera.position.z, dir.x, dir.y, dir.z, REACH);
  if (hit) socket.emit('blockDestroy', { x: hit.x, y: hit.y, z: hit.z });
}

function placeBlock() {
  var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  var hit = raycastVoxels(camera.position.x, camera.position.y, camera.position.z, dir.x, dir.y, dir.z, REACH);
  if (hit) {
    var type = inventory[selHot] ? inventory[selHot].type : 0;
    if (type) socket.emit('blockPlace', { x: hit.px, y: hit.py, z: hit.pz, type: type });
  }
}

// ---- Networking ----
var urlParams = new URLSearchParams(window.location.search);
var authToken = urlParams.get('token') || '';
var socket = io({ query: { token: authToken } });

socket.on('init', function(data) {
  localId = data.id;
  var parts = ['ID: ' + data.id.slice(0, 8)];
  if (data.username) parts.push('User: ' + data.username);
  document.getElementById('info').textContent = parts.join(' | ');
  for (var i = 0; i < data.players.length; i++) {
    var p = data.players[i];
    if (p.id === data.id) continue;
    var mesh = createPlayerMesh();
    mesh.position.set(p.x, p.y, p.z);
    scene.add(mesh);
    otherPlayers.set(p.id, mesh);
  }
});

socket.on('chunk', function(d) { loadChunk(d.cx, d.cz, d.data); });

socket.on('blockUpdate', function(d) {
  var cx = Math.floor(d.x / CS), cz = Math.floor(d.z / CS);
  var lx = ((d.x % CS) + CS) % CS, lz = ((d.z % CS) + CS) % CS;
  var key = cx + ',' + cz;
  var chunk = chunks.get(key);
  if (!chunk) return;
  chunk.blocks[lx + lz * CS + d.y * CS * CS] = d.type;
  loadChunk(cx, cz, chunk.blocks.buffer.slice(0));
});

socket.on('inventory', function(data) {
  inventory = data;
  updateHUD();
  if (invOpen) renderInv();
});

socket.on('health', function(h) { health = h; updateHUD(); });
socket.on('respawn', function(pos) { camera.position.set(pos.x, pos.y, pos.z); vel.set(0, 0, 0); });

socket.on('timeUpdate', function(time) {
  var angle = (time / 24000) * Math.PI * 2;
  var r = 80;
  sun.position.set(Math.cos(angle) * r, Math.sin(angle) * r + 20, 40);
  var b = Math.max(0.15, Math.sin(angle));
  sun.intensity = b * 1.0;
  ambient.intensity = 0.2 + b * 0.35;
  hemi.intensity = 0.2 + b * 0.4;
  var skyHue = 0.58 + (1 - b) * 0.08;
  var skySat = 0.3 + b * 0.3;
  var skyLight = 0.2 + b * 0.45;
  var skyColor = new THREE.Color().setHSL(skyHue, skySat, skyLight);
  scene.background = skyColor;
  scene.fog.color = skyColor;
});

socket.on('playerJoin', function(p) {
  if (otherPlayers.has(p.id) || p.id === localId) return;
  var mesh = createPlayerMesh();
  mesh.position.set(p.x, p.y, p.z);
  scene.add(mesh);
  otherPlayers.set(p.id, mesh);
});

socket.on('playerMove', function(p) {
  var mesh = otherPlayers.get(p.id);
  if (mesh) { mesh.position.set(p.x, p.y, p.z); mesh.rotation.y = p.ry; }
});

socket.on('playerLeave', function(id) {
  var mesh = otherPlayers.get(id);
  if (mesh) { scene.remove(mesh); otherPlayers.delete(id); }
});

// ---- Other players ----
var playerGeo = new THREE.BoxGeometry(0.6, 1.8, 0.6);
var playerMat = new THREE.MeshLambertMaterial({ color: 0xff6600 });
var otherPlayers = new Map();

function createPlayerMesh() {
  var g = new THREE.Group();
  var body = new THREE.Mesh(playerGeo, playerMat);
  body.position.y = 0.9;
  g.add(body);
  var head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0xFFCC99 }));
  head.position.y = 1.8;
  g.add(head);
  return g;
}

// ---- Resize ----
addEventListener('resize', function() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Stars (small dots in sky) ----
var starsGeo = new THREE.BufferGeometry();
var starPos = [];
for (var i = 0; i < 2000; i++) {
  var theta = Math.random() * Math.PI * 2;
  var phi = Math.acos(Math.random() * 2 - 1);
  var sr = 120;
  starPos.push(Math.sin(phi) * Math.cos(theta) * sr);
  starPos.push(Math.sin(phi) * Math.sin(theta) * sr);
  starPos.push(Math.cos(phi) * sr);
}
starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
var starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.8 });
var stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);

// Hide/show stars based on time
var lastDayB = 0.5;
setInterval(function() {
  var b = sun.intensity;
  stars.visible = b < 0.4;
}, 1000);

// ---- Loop ----
var prev = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  var dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;
  if (locked && !invOpen) updatePlayer(dt);
  renderer.render(scene, camera);
}
tick(performance.now());
