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
        this._setWebviewMessageListener(this._panel.webview);
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
            // Get config values - using both spiderScreenshot and codesnap for compatibility
            const spiderConfig = vscode.workspace.getConfiguration('spiderScreenshot');
            const codesnapConfig = vscode.workspace.getConfiguration('codesnap');
            const folder = spiderConfig.get('screenshotFolder') || codesnapConfig.get('screenshotDirectory') || '';
            const imgurClientId = spiderConfig.get('imgurClientId') || '';
            const autoScreenshot = spiderConfig.get('autoScreenshot') || codesnapConfig.get('autoScreenshotOnSave') || false;
            const cloudSync = codesnapConfig.get('enableCloudSync') || false;
            const keepMaxSnapshots = codesnapConfig.get('keepMaxSnapshots') || 200;
            const maxSnapshotSize = codesnapConfig.get('maxSnapshotSize') || 1;
            const telemetry = codesnapConfig.get('telemetry') !== false;
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
          }
          h1 {
            font-size: 1.8rem;
            margin-bottom: 1.5rem;
            color: var(--vscode-titleBar-activeForeground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
          }
          h2 {
            font-size: 1.3rem;
            margin-top: 1.5rem;
            margin-bottom: 1rem;
            color: var(--vscode-settings-headerForeground);
          }
          .section {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-top: 1rem;
            font-weight: 500;
          }
          input[type="text"], input[type="number"] {
            width: 100%;
            padding: 8px;
            margin-top: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            box-sizing: border-box;
          }
          input[type="checkbox"] {
            margin-right: 8px;
            transform: scale(1.2);
          }
          .checkbox-label {
            display: flex;
            align-items: center;
            margin-top: 1rem;
            cursor: pointer;
          }
          button {
            margin-top: 16px;
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
          }
          .button-group {
            display: flex;
            gap: 10px;
            margin-top: 10px;
          }
          .badge {
            display: inline-block;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            margin-left: 8px;
          }
          .beta {
            background-color: #ff6b4a;
            color: white;
          }
          .pro-tag {
            background-color: #6c5ce7;
            color: white;
          }
          .info-text {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            margin-top: 4px;
          }
          hr {
            border: none;
            border-top: 1px solid var(--vscode-panel-border);
            margin: 20px 0;
          }
          .privacy-note {
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            border-radius: 4px;
            padding: 12px;
            margin: 20px 0;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <h1>🕷️ Spider Screenshot Settings</h1>
        
        <div class="privacy-note">
          <strong>🔒 Privacy First:</strong> No personal data collected. 
          Anonymous telemetry helps improve the extension. You can disable below.
        </div>
        
        <div class="section">
          <h2>📸 Screenshot Settings</h2>
          
          <label>Save Folder:
            <div class="button-group">
              <input type="text" id="folder" value="${folder}" placeholder="~/SpiderScreenshots" />
              <button id="browse" class="secondary">📁 Browse</button>
            </div>
            <div class="info-text">Leave empty for default: ~/SpiderScreenshots</div>
          </label>

          <label>Max Snapshots to Keep:
            <input type="number" id="keepMaxSnapshots" value="${keepMaxSnapshots}" min="1" max="1000" />
            <div class="info-text">Older snapshots will be automatically deleted</div>
          </label>

          <label>Max Snapshot Size (MB):
            <input type="number" id="maxSnapshotSize" value="${maxSnapshotSize}" min="0.1" max="10" step="0.1" />
            <div class="info-text">Prevents saving huge files (0.1MB - 10MB)</div>
          </label>

          <label class="checkbox-label">
            <input type="checkbox" id="autoScreenshot" ${autoScreenshot ? 'checked' : ''} />
            <span>📸 Auto Screenshot on Save</span>
          </label>
        </div>

        <div class="section">
          <h2>☁️ Cloud Sync <span class="badge beta">BETA</span></h2>
          
          <label class="checkbox-label">
            <input type="checkbox" id="cloudSync" ${cloudSync ? 'checked' : ''} />
            <span>Enable Cloud Sync <span class="badge">Free: 100 saves</span></span>
          </label>
          <div class="info-text">Sync snapshots to cloud. Free tier includes 100 saves. Pro = unlimited.</div>
        </div>

        <div class="section">
          <h2>🖼️ Imgur Integration</h2>
          
          <label>Imgur Client ID:
            <input type="text" id="imgurClientId" value="${imgurClientId}" placeholder="Your Imgur Client ID" />
            <div class="info-text">Required for uploading screenshots to Imgur</div>
          </label>
        </div>

        <div class="section">
          <h2>📊 Telemetry & Privacy</h2>
          
          <label class="checkbox-label">
            <input type="checkbox" id="telemetry" ${telemetry ? 'checked' : ''} />
            <span>Allow anonymous usage telemetry</span>
          </label>
          <div class="info-text">Helps us understand which features to improve. No personal data collected.</div>
        </div>

        <hr />

        <div class="section">
          <h2>🚀 Spider Pro <span class="badge pro-tag">EARLY ACCESS</span></h2>
          <p>Get unlimited cloud sync, PDF export, AI features, and more!</p>
          <div class="button-group">
            <button id="joinWaitlist">✨ Join Waitlist (Lifetime Discount)</button>
            <button id="enterLicense" class="secondary">🔑 Enter License Key</button>
          </div>
          <div class="info-text">Early access members get a lifetime discount!</div>
        </div>

        <div class="button-group">
          <button id="save">💾 Save Settings</button>
          <button id="reset" class="secondary">↺ Reset to Defaults</button>
        </div>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();

          document.getElementById('save').addEventListener('click', () => {
            vscode.postMessage({
              command: 'save',
              folder: document.getElementById('folder').value,
              imgurClientId: document.getElementById('imgurClientId').value,
              autoScreenshot: document.getElementById('autoScreenshot').checked,
              cloudSync: document.getElementById('cloudSync').checked,
              keepMaxSnapshots: parseInt(document.getElementById('keepMaxSnapshots').value) || 200,
              maxSnapshotSize: parseFloat(document.getElementById('maxSnapshotSize').value) || 1,
              telemetry: document.getElementById('telemetry').checked
            });
          });

          document.getElementById('reset').addEventListener('click', () => {
            vscode.postMessage({ command: 'reset' });
          });

          document.getElementById('browse').addEventListener('click', () => {
            vscode.postMessage({ command: 'pickFolder' });
          });

          document.getElementById('joinWaitlist').addEventListener('click', () => {
            vscode.postMessage({ command: 'joinWaitlist' });
          });

          document.getElementById('enterLicense').addEventListener('click', () => {
            vscode.postMessage({ command: 'enterLicense' });
          });

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'setFolder') {
              document.getElementById('folder').value = message.folder;
            } else if (message.command === 'resetValues') {
              document.getElementById('folder').value = '';
              document.getElementById('imgurClientId').value = '';
              document.getElementById('autoScreenshot').checked = false;
              document.getElementById('cloudSync').checked = false;
              document.getElementById('keepMaxSnapshots').value = 200;
              document.getElementById('maxSnapshotSize').value = 1;
              document.getElementById('telemetry').checked = true;
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
                    // Save to both configs for compatibility
                    const spiderConfig = vscode.workspace.getConfiguration('spiderScreenshot');
                    const codesnapConfig = vscode.workspace.getConfiguration('codesnap');
                    yield spiderConfig.update('screenshotFolder', message.folder, vscode.ConfigurationTarget.Global);
                    yield spiderConfig.update('imgurClientId', message.imgurClientId, vscode.ConfigurationTarget.Global);
                    yield spiderConfig.update('autoScreenshot', message.autoScreenshot, vscode.ConfigurationTarget.Global);
                    yield codesnapConfig.update('screenshotDirectory', message.folder, vscode.ConfigurationTarget.Global);
                    yield codesnapConfig.update('autoScreenshotOnSave', message.autoScreenshot, vscode.ConfigurationTarget.Global);
                    yield codesnapConfig.update('enableCloudSync', message.cloudSync, vscode.ConfigurationTarget.Global);
                    yield codesnapConfig.update('keepMaxSnapshots', message.keepMaxSnapshots, vscode.ConfigurationTarget.Global);
                    yield codesnapConfig.update('maxSnapshotSize', message.maxSnapshotSize, vscode.ConfigurationTarget.Global);
                    yield codesnapConfig.update('telemetry', message.telemetry, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('✅ Settings saved successfully!');
                    break;
                case 'reset':
                    const resetSpider = vscode.workspace.getConfiguration('spiderScreenshot');
                    const resetCodesnap = vscode.workspace.getConfiguration('codesnap');
                    yield resetSpider.update('screenshotFolder', '', vscode.ConfigurationTarget.Global);
                    yield resetSpider.update('imgurClientId', '', vscode.ConfigurationTarget.Global);
                    yield resetSpider.update('autoScreenshot', false, vscode.ConfigurationTarget.Global);
                    yield resetCodesnap.update('screenshotDirectory', '', vscode.ConfigurationTarget.Global);
                    yield resetCodesnap.update('autoScreenshotOnSave', false, vscode.ConfigurationTarget.Global);
                    yield resetCodesnap.update('enableCloudSync', false, vscode.ConfigurationTarget.Global);
                    yield resetCodesnap.update('keepMaxSnapshots', 200, vscode.ConfigurationTarget.Global);
                    yield resetCodesnap.update('maxSnapshotSize', 1, vscode.ConfigurationTarget.Global);
                    yield resetCodesnap.update('telemetry', true, vscode.ConfigurationTarget.Global);
                    webview.postMessage({ command: 'resetValues' });
                    vscode.window.showInformationMessage('↺ Settings reset to defaults');
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
                case 'joinWaitlist':
                    vscode.env.openExternal(vscode.Uri.parse('https://bit.ly/4kGMUWu'));
                    break;
                case 'enterLicense':
                    vscode.commands.executeCommand('codesnap.enterLicenseKey');
                    break;
            }
        }), undefined, this._disposables);
    }
}
exports.default = SettingsPanel;
//# sourceMappingURL=SettingsPanel.js.map