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
        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri, context);
    }
    constructor(panel, extensionUri, context) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._panel.webview.html = this._getHtml(this._panel.webview, context);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'saveSettings':
                    vscode.workspace.getConfiguration('codesnap').update('screenshotDirectory', message.screenshotDirectory, true);
                    vscode.workspace.getConfiguration('codesnap').update('imgurClientId', message.imgurClientId, true);
                    vscode.workspace.getConfiguration('codesnap').update('autoScreenshotOnSave', message.autoScreenshotOnSave, true);
                    vscode.window.showInformationMessage('✅ Settings updated!');
                    return;
                case 'activatePro':
                    if (message.licenseKey === 'SPIDERPRO-2025-UNLOCKED') {
                        context?.globalState.update('spiderLicenseKey', message.licenseKey);
                        vscode.window.showInformationMessage('🟢 Pro License Activated!');
                    }
                    else {
                        vscode.window.showErrorMessage('🚫 Invalid license key.');
                    }
                    return;
            }
        });
    }
    dispose() {
        SettingsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
    _getHtml(webview, context) {
        const nonce = (0, getNonce_1.getNonce)();
        const savedDir = vscode.workspace.getConfiguration('codesnap').get('screenshotDirectory') || '';
        const imgurKey = vscode.workspace.getConfiguration('codesnap').get('imgurClientId') || '';
        const autoSnap = vscode.workspace.getConfiguration('codesnap').get('autoScreenshotOnSave') || false;
        const license = context?.globalState.get('spiderLicenseKey') === 'SPIDERPRO-2025-UNLOCKED';
        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Spider Settings</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          .tab {
            display: none;
          }
          .tab.active {
            display: block;
          }
          .tabs {
            display: flex;
            margin-bottom: 10px;
            gap: 10px;
          }
          button.tablink {
            padding: 8px 16px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="tabs">
          <button class="tablink" onclick="openTab('settings')">Settings</button>
          <button class="tablink" onclick="openTab('pro')">Pro</button>
        </div>

        <div id="settings" class="tab active">
          <h2>Screenshot Settings</h2>
          <label>Screenshot Save Folder:</label><br>
          <input id="screenshotDir" type="text" value="${savedDir}" style="width:100%" /><br><br>
          
          <label>Imgur Client ID:</label><br>
          <input id="imgurKey" type="text" value="${imgurKey}" style="width:100%" /><br><br>
          
          <label><input id="autoSnap" type="checkbox" ${autoSnap ? 'checked' : ''}/> Auto Screenshot on Save</label><br><br>
          
          <button onclick="save()">💾 Save Settings</button>
        </div>

        <div id="pro" class="tab">
          <h2>Activate Spider Pro</h2>
          <p>${license ? '🟢 License is active!' : '🔒 Enter your license key to activate Pro features.'}</p>
          ${license ? '' : `
            <input id="licenseKey" type="text" placeholder="Enter license key..." style="width:100%" /><br><br>
            <button onclick="activate()">🔓 Activate Pro</button>
          `}
        </div>

        <script nonce="${nonce}">
          function openTab(id) {
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            document.getElementById(id).classList.add('active');
          }

          function save() {
            const message = {
              command: 'saveSettings',
              screenshotDirectory: document.getElementById('screenshotDir').value,
              imgurClientId: document.getElementById('imgurKey').value,
              autoScreenshotOnSave: document.getElementById('autoSnap').checked
            };
            window.vscode.postMessage(message);
          }

          function activate() {
            const key = document.getElementById('licenseKey').value;
            window.vscode.postMessage({ command: 'activatePro', licenseKey: key });
          }

          window.vscode = acquireVsCodeApi();
        </script>
      </body>
      </html>
    `;
    }
}
exports.default = SettingsPanel;
