// ---- Animated background ----
var canvas = document.getElementById('bg-canvas');
var ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
addEventListener('resize', resize);

var blocks = [];
var WORLD_W = 24;
for (var x = -WORLD_W / 2; x < WORLD_W / 2; x++) {
  for (var z = -WORLD_W / 2; z < WORLD_W / 2; z++) {
    var h = Math.floor(Math.sin(x * 0.3) * Math.cos(z * 0.25) * 2 + 3);
    for (var y = 0; y <= h; y++) {
      blocks.push({ x: x, y: y, z: z, type: y === h ? 1 : (y === h - 1 ? 2 : 3) });
    }
    if (Math.random() < 0.04 && h > 1) {
      for (var ty = 1; ty <= 4; ty++) blocks.push({ x: x, y: h + ty, z: z, type: 7 });
      for (var dx = -1; dx <= 1; dx++)
        for (var dz = -1; dz <= 1; dz++)
          for (var ly = 4; ly <= 5; ly++)
            if (!(Math.abs(dx) === 1 && Math.abs(dz) === 1))
              blocks.push({ x: x + dx, y: h + ly, z: z + dz, type: 8 });
    }
  }
}

var colors = { 1: '#4CAF50', 2: '#795548', 3: '#9E9E9E', 7: '#5D4037', 8: '#2E7D32' };
var angle = 0;
var radius = 28;

function drawBlock(ctx, x, y, z, type, camX, camY, camZ, yaw, pitch) {
  var color = colors[type] || '#888';
  var dx = x + 0.5 - camX, dy = y + 0.5 - camY, dz = z + 0.5 - camZ;
  var cy = Math.cos(yaw), sy = Math.sin(yaw);
  var cp = Math.cos(pitch), sp = Math.sin(pitch);
  var rx = dx * cy - dz * sy; dz = dx * sy + dz * cy; dx = rx;
  var ry = dy * cp - dz * sp; dz = dy * sp + dz * cp; dy = ry;
  if (dz <= 0) return;
  var fov = 500;
  var sx = (dx / dz) * fov + canvas.width / 2;
  var sy2 = -(dy / dz) * fov + canvas.height / 2;
  var s = (1 / dz) * fov;
  if (s < 1) return;
  var shade = Math.max(0.4, Math.min(1, 1 - dz / 50));
  var r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
  ctx.fillStyle = 'rgb(' + (r * shade | 0) + ',' + (g * shade | 0) + ',' + (b * shade | 0) + ')';
  ctx.fillRect(sx - s / 2, sy2 - s / 2, s, s);
  ctx.strokeStyle = 'rgba(0,0,0,' + (0.1 * shade) + ')';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(sx - s / 2, sy2 - s / 2, s, s);
}

function drawScene(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var skyTime = Math.sin(time * 0.0001) * 0.3 + 0.5;
  var grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, 'hsl(210, 60%, ' + (20 + skyTime * 40) + '%)');
  grad.addColorStop(0.6, 'hsl(210, 50%, ' + (30 + skyTime * 30) + '%)');
  grad.addColorStop(1, '#87CEEB');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var sunX = canvas.width * (0.2 + Math.sin(time * 0.0001) * 0.3);
  var sunY = canvas.height * (0.15 + Math.cos(time * 0.0002) * 0.15);
  var sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 40);
  sg.addColorStop(0, 'rgba(255,255,200,0.8)');
  sg.addColorStop(0.5, 'rgba(255,255,200,0.3)');
  sg.addColorStop(1, 'rgba(255,255,200,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sunX, sunY, 40, 0, Math.PI * 2); ctx.fill();

  angle = time * 0.00005;
  var camX = Math.sin(angle) * radius, camZ = Math.cos(angle) * radius;
  var yaw = Math.atan2(-camX, -camZ);
  var sorted = blocks.slice().sort(function(a, b) {
    var da = (a.x + 0.5 - camX) * (a.x + 0.5 - camX) + (a.z + 0.5 - camZ) * (a.z + 0.5 - camZ);
    var db = (b.x + 0.5 - camX) * (b.x + 0.5 - camX) + (b.z + 0.5 - camZ) * (b.z + 0.5 - camZ);
    return db - da;
  });
  for (var i = 0; i < sorted.length; i++) {
    var b = sorted[i];
    drawBlock(ctx, b.x, b.y, b.z, b.type, camX, 10, camZ, yaw, -0.3);
  }
}

var clouds = [];
for (var i = 0; i < 20; i++) clouds.push({ x: Math.random() * 100 - 50, z: Math.random() * 100 - 50, w: 4 + Math.random() * 8 });

function drawClouds(time) {
  for (var i = 0; i < clouds.length; i++) {
    var c = clouds[i];
    var sx = ((c.x + time * 0.002) % 60 - 30) / 30 * 200 + canvas.width / 2;
    var sy = canvas.height * 0.2;
    var s = c.w / 30 * 200;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.ellipse(sx, sy, s, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function animate(time) {
  drawScene(time);
  drawClouds(time);
  requestAnimationFrame(animate);
}
animate(0);

// ---- Auth state ----
var authToken = localStorage.getItem('mc_auth_token');
var authUser = localStorage.getItem('mc_auth_username');

function updateUserUI() {
  var info = document.getElementById('user-info');
  var name = document.getElementById('user-name');
  if (authToken && authUser) {
    info.style.display = 'flex';
    name.textContent = authUser;
  } else {
    info.style.display = 'none';
  }
}

if (authToken) {
  fetch('/api/verify', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: authToken}) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.ok) {
        localStorage.removeItem('mc_auth_token');
        localStorage.removeItem('mc_auth_username');
        authToken = null;
        authUser = null;
      }
      updateUserUI();
    });
}
updateUserUI();

// ---- Login modal ----
var authMode = 'login';

function showLogin() {
  document.getElementById('login-modal').style.display = 'flex';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-username').value = '';
  document.getElementById('auth-password').value = '';
}

function hideLogin() {
  document.getElementById('login-modal').style.display = 'none';
}

function switchTab(mode) {
  authMode = mode;
  var tabs = document.querySelectorAll('#login-tabs .tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  document.querySelector('#login-tabs .tab[onclick*="' + mode + '"]').classList.add('active');
  document.getElementById('auth-submit').textContent = mode === 'login' ? 'Sign In' : 'Register';
  document.getElementById('auth-error').textContent = '';
}

function submitAuth() {
  var username = document.getElementById('auth-username').value.trim();
  var password = document.getElementById('auth-password').value;
  var errEl = document.getElementById('auth-error');
  var btn = document.getElementById('auth-submit');

  if (!username || !password) { errEl.textContent = 'Fill in all fields'; return; }

  btn.disabled = true;
  btn.textContent = 'Please wait...';
  var endpoint = authMode === 'login' ? '/api/login' : '/api/register';

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password }),
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) {
        authToken = data.token;
        authUser = data.username;
        localStorage.setItem('mc_auth_token', authToken);
        localStorage.setItem('mc_auth_username', authUser);
        updateUserUI();
        hideLogin();
      } else {
        errEl.textContent = data.error || 'Something went wrong';
      }
    })
    .catch(function() { errEl.textContent = 'Connection error'; })
    .finally(function() {
      btn.disabled = false;
      btn.textContent = authMode === 'login' ? 'Sign In' : 'Register';
    });
}

function logout() {
  authToken = null;
  authUser = null;
  localStorage.removeItem('mc_auth_token');
  localStorage.removeItem('mc_auth_username');
  updateUserUI();
}

// ---- OAuth ----
function oauthSignIn(provider) {
  document.getElementById('auth-error').textContent = '';
  
  // Mock OAuth popup - simulates the OAuth flow
  var mockEmail = (provider === 'google' ? 'user' : provider) + '@' + 
    (provider === 'google' ? 'gmail.com' : 
     provider === 'apple' ? 'icloud.com' : 
     provider === 'microsoft' ? 'outlook.com' : 'steampowered.com');
  
  var popup = window.open('', 'oauth', 'width=400,height=500,left=200,top=200');
  if (!popup) {
    document.getElementById('auth-error').textContent = 'Popup blocked. Please allow popups for this site.';
    return;
  }
  
  var providers = {
    google: { name: 'Google', color: '#4285F4', icon: 'G' },
    apple: { name: 'Apple', color: '#fff', icon: '\uF8FF' },
    microsoft: { name: 'Microsoft', color: '#00A4EF', icon: '\u25C6' },
    steam: { name: 'Steam', color: '#1b2838', icon: '\u2B21' },
  };
  var p = providers[provider];
  
  popup.document.write('<!DOCTYPE html><html><head><title>Sign in with ' + p.name + '</title><style>');
  popup.document.write('body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a1a;color:#fff}');
  popup.document.write('.icon{font-size:48px;width:80px;height:80px;display:flex;align-items:center;justify-content:center;border-radius:50%;margin-bottom:16px}');
  popup.document.write('h2{margin:0 0 4px}h3{color:#888;margin:0 0 20px;font-weight:normal}');
  popup.document.write('input{padding:10px;width:250px;margin-bottom:12px;background:#333;border:1px solid #555;color:#fff;border-radius:4px;font-size:14px}');
  popup.document.write('button{padding:10px 24px;background:' + p.color + ';color:' + (provider==='apple'?'#000':'#fff') + ';border:none;border-radius:4px;font-size:14px;cursor:pointer;font-weight:bold}');
  popup.document.write('.note{color:#666;font-size:11px;margin-top:12px;max-width:280px;text-align:center}');
  popup.document.write('</style></head><body>');
  popup.document.write('<div class="icon" style="background:' + p.color + '20;color:' + p.color + '">' + p.icon + '</div>');
  popup.document.write('<h2>Sign in with ' + p.name + '</h2>');
  popup.document.write('<h3>' + mockEmail + '</h3>');
  popup.document.write('<input type="text" id="oauth-username" placeholder="Choose username" value="' + 
    (provider === 'google' ? 'Player' : provider.charAt(0).toUpperCase() + provider.slice(1) + 'User') + '">');
  popup.document.write('<button onclick="doAuth()">Continue with ' + p.name + '</button>');
  popup.document.write('<p class="note">This is a simulated OAuth flow for demonstration purposes.</p>');
  popup.document.write('<script>function doAuth(){var u=document.getElementById("oauth-username").value.trim();if(u){window.opener.postMessage({provider:"' + provider + '",username:u},"*");window.close()}else alert("Enter a username")}<\/script>');
  popup.document.write('</body></html>');
  popup.document.close();
}

// Listen for OAuth result
window.addEventListener('message', function(event) {
  if (event.data && event.data.provider && event.data.username) {
    var username = event.data.username;
    var password = 'oauth_' + event.data.provider + '_' + Date.now(); // auto-generated password
    
    // Auto-register or login via OAuth
    fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password }),
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) {
        authToken = data.token;
        authUser = data.username;
        localStorage.setItem('mc_auth_token', authToken);
        localStorage.setItem('mc_auth_username', authUser);
        updateUserUI();
        hideLogin();
        document.getElementById('auth-error').textContent = '';
      } else if (data.error === 'Username already taken') {
        // Try login instead
        return fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, password: password }),
        }).then(function(r) { return r.json(); });
      }
    })
    .then(function(data) {
      if (data && data.ok) {
        authToken = data.token;
        authUser = data.username;
        localStorage.setItem('mc_auth_token', authToken);
        localStorage.setItem('mc_auth_username', authUser);
        updateUserUI();
        hideLogin();
      }
    })
    .catch(function() {
      document.getElementById('auth-error').textContent = 'OAuth sign-in failed';
    });
  }
});

function oauthComingSoon() {
  document.getElementById('auth-error').textContent = '';
}

// ---- Enter key for auth ----
document.getElementById('auth-password').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') submitAuth();
});
document.getElementById('auth-username').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('auth-password').focus();
});

// ---- Start game ----
function startGame() {
  var url = '/game.html';
  if (authToken) url += '?token=' + authToken;
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'flex';
  setTimeout(function() { window.location.href = url; }, 1500);
}
