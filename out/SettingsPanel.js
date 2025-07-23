"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const getNonce_1 = require("./getNonce");
class SettingsPanel {
    static show(extensionUri, context) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('spiderSettings', 'Spider Screenshot Settings', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
        });
        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.getHtmlForWebview(this._panel.webview).then(html => {
            this._panel.webview.html = html;
        });
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    dispose() {
        SettingsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x)
                x.dispose();
        }
    }
    getHtmlForWebview(webview) {
        return __awaiter(this, void 0, void 0, function* () {
            const nonce = (0, getNonce_1.getNonce)();
            const config = vscode.workspace.getConfiguration('spiderScreenshot');
            const folder = config.get('screenshotFolder') || '';
            const imgurClientId = config.get('imgurClientId') || '';
            const autoScreenshot = config.get('autoScreenshot') || false;
            return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Spider Screenshot Settings</title>
        <style>
          body {
            font-family: sans-serif;
            padding: 16px;
          }
          h1 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
          }
          label {
            display: block;
            margin-top: 1rem;
          }
          input[type="text"] {
            width: 100%;
            padding: 6px;
            margin-top: 4px;
          }
          button {
            margin-top: 16px;
            padding: 8px 16px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <h1>🕷️ Spider Screenshot Settings</h1>
        <label>Screenshot Save Folder:
          <input type="text" id="folder" value="${folder}" />
          <button id="browse">📁 Browse</button>
        </label>

        <label>Imgur Client ID:
          <input type="text" id="imgurClientId" value="${imgurClientId}" />
        </label>

        <label>
          <input type="checkbox" id="autoScreenshot" ${autoScreenshot ? 'checked' : ''} />
          Auto Screenshot on Save
        </label>

        <button id="save">💾 Save Settings</button>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();

          document.getElementById('save').addEventListener('click', () => {
            vscode.postMessage({
              command: 'save',
              folder: document.getElementById('folder').value,
              imgurClientId: document.getElementById('imgurClientId').value,
              autoScreenshot: document.getElementById('autoScreenshot').checked
            });
          });

          document.getElementById('browse').addEventListener('click', () => {
            vscode.postMessage({ command: 'pickFolder' });
          });

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'setFolder') {
              document.getElementById('folder').value = message.folder;
            }
          });
        </script>
      </body>
      </html>
    `;
        });
    }
    _setWebviewMessageListener(webview) {
        webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
            switch (message.command) {
                case 'save':
                    const config = vscode.workspace.getConfiguration('spiderScreenshot');
                    yield config.update('screenshotFolder', message.folder, vscode.ConfigurationTarget.Global);
                    yield config.update('imgurClientId', message.imgurClientId, vscode.ConfigurationTarget.Global);
                    yield config.update('autoScreenshot', message.autoScreenshot, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Settings saved successfully!');
                    break;
                case 'pickFolder':
                    const folders = yield vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Folder'
                    });
                    if (folders && folders.length > 0) {
                        webview.postMessage({ command: 'setFolder', folder: folders[0].fsPath });
                    }
                    break;
            }
        }), undefined, this._disposables);
    }
}
exports.default = SettingsPanel;
//# sourceMappingURL=SettingsPanel.js.map