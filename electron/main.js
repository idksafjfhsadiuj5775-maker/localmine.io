import { app, BrowserWindow, dialog } from 'electron';
import { fork } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { autoUpdater } from 'electron-updater';
import { platform } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow = null;
let serverProcess = null;
const EMBEDDED_PORT = 3001;
const SERVER_SCRIPT = join(__dirname, '..', 'server', 'index.js');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 854,
    minHeight: 480,
    title: 'Minecraft Lite',
    icon: join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setFullScreen(true);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(`http://localhost:${EMBEDDED_PORT}`);
}

function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = fork(SERVER_SCRIPT, [], {
      env: {
        ...process.env,
        ELECTRON_EMBEDDED: 'true',
        EMBEDDED_PORT: String(EMBEDDED_PORT),
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    serverProcess.on('message', (msg) => {
      if (msg === 'server-ready') {
        resolve();
      }
    });

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('Embedded server ready')) {
        resolve();
      }
      if (mainWindow) mainWindow.webContents.executeJavaScript(`console.log(${JSON.stringify(data.toString())})`);
    });

    serverProcess.stderr.on('data', (data) => {
      if (mainWindow) mainWindow.webContents.executeJavaScript(`console.error(${JSON.stringify(data.toString())})`);
    });

    serverProcess.on('error', (err) => {
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      if (mainWindow) {
        dialog.showErrorBox('Server Crashed', `The game server exited unexpectedly (code: ${code}).\nPlease restart the application.`);
      }
    });

    setTimeout(() => resolve(), 5000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

async function checkForUpdates() {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result;
  } catch {
    return null;
  }
}

app.whenReady().then(async () => {
  await startServer();

  checkForUpdates();

  autoUpdater.on('update-available', () => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(
        `console.log('Update available — downloading...')`
      );
    }
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart to apply the update?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(
        `console.error('Auto-update error: ${err.message}')`
      );
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  stopServer();
  if (platform() !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  stopServer();
});
