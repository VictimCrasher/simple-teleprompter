import { ipcMain, dialog, app, BrowserWindow, screen } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let configWindow = null;
let teleprompterWindow = null;
const getConfigWindowUrl = () => VITE_DEV_SERVER_URL ?? `file://${path.join(RENDERER_DIST, "index.html")}`;
const getTeleprompterWindowUrl = () => {
  const base = getConfigWindowUrl();
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}window=teleprompter`;
};
function createConfigWindow() {
  configWindow = new BrowserWindow({
    icon: "./public/icons/icon@2x.png",
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  configWindow.webContents.on("did-finish-load", () => {
    configWindow == null ? void 0 : configWindow.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    configWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    configWindow.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  configWindow.on("closed", () => {
    configWindow = null;
  });
}
const TELEPROMPTER_WIDTH = 720;
const TELEPROMPTER_HEIGHT_MAP = {
  small: 275,
  medium: 350,
  large: 475
};
function getBoundsForAlignment(alignment, height) {
  const primary = screen.getPrimaryDisplay();
  const { x: wx, y: wy, width: sw, height: sh } = primary.workArea;
  const w = TELEPROMPTER_WIDTH;
  const h = height;
  switch (alignment) {
    case "top-left":
      return { x: wx, y: wy, width: w, height: h };
    case "top":
      return { x: wx + Math.round((sw - w) / 2), y: wy, width: w, height: h };
    case "top-right":
      return { x: wx + sw - w, y: wy, width: w, height: h };
    case "left":
      return { x: wx, y: wy + Math.round((sh - h) / 2), width: w, height: h };
    case "middle":
      return {
        x: wx + Math.round((sw - w) / 2),
        y: wy + Math.round((sh - h) / 2),
        width: w,
        height: h
      };
    case "right":
      return { x: wx + sw - w, y: wy + Math.round((sh - h) / 2), width: w, height: h };
    case "bottom-left":
      return { x: wx, y: wy + sh - h, width: w, height: h };
    case "bottom":
      return { x: wx + Math.round((sw - w) / 2), y: wy + sh - h, width: w, height: h };
    case "bottom-right":
      return { x: wx + sw - w, y: wy + sh - h, width: w, height: h };
    default:
      return { x: wx + Math.round((sw - w) / 2), y: wy + Math.round((sh - h) / 2), width: w, height: h };
  }
}
function createTeleprompterWindow(payload) {
  if (teleprompterWindow) {
    teleprompterWindow.focus();
    teleprompterWindow.webContents.send("teleprompter-config", payload);
    return;
  }
  const alignment = payload.alignment ?? "middle";
  const windowHeight = payload.windowHeight ?? "medium";
  const height = TELEPROMPTER_HEIGHT_MAP[windowHeight];
  const bounds = getBoundsForAlignment(alignment, height);
  teleprompterWindow = new BrowserWindow({
    icon: "./public/icons/icon@2x.png",
    ...bounds,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    },
    autoHideMenuBar: true
  });
  teleprompterWindow.setAlwaysOnTop(payload.alwaysOnTop);
  const url = getTeleprompterWindowUrl();
  if (VITE_DEV_SERVER_URL) {
    teleprompterWindow.loadURL(url);
  } else {
    teleprompterWindow.loadFile(path.join(RENDERER_DIST, "index.html"), { query: { window: "teleprompter" } });
  }
  teleprompterWindow.webContents.on("did-finish-load", () => {
    teleprompterWindow == null ? void 0 : teleprompterWindow.webContents.send("teleprompter-config", payload);
  });
  teleprompterWindow.on("closed", () => {
    teleprompterWindow = null;
    configWindow == null ? void 0 : configWindow.show();
  });
  configWindow == null ? void 0 : configWindow.hide();
}
ipcMain.handle(
  "open-teleprompter",
  (_event, payload) => {
    createTeleprompterWindow(payload);
  }
);
ipcMain.handle("close-teleprompter", () => {
  if (teleprompterWindow) {
    teleprompterWindow.close();
    teleprompterWindow = null;
  }
  configWindow == null ? void 0 : configWindow.show();
});
ipcMain.handle(
  "set-always-on-top",
  (_event, { window: winId, value }) => {
    const win = winId === "config" ? configWindow : teleprompterWindow;
    win == null ? void 0 : win.setAlwaysOnTop(value);
  }
);
ipcMain.handle("open-txt-dialog", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Text", extensions: ["txt"] }]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { path: null, content: null };
  }
  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, "utf-8");
  return { path: filePath, content };
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    configWindow = null;
    teleprompterWindow = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createConfigWindow();
  }
});
app.whenReady().then(createConfigWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
