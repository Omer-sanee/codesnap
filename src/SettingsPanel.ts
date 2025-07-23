import * as vscode from 'vscode';
import { getNonce } from './getNonce';

export default class SettingsPanel {
  public static currentPanel: SettingsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static show(extensionUri: vscode.Uri, context?: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'spiderSettings',
      'Spider Screenshot Settings',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

  this.getHtmlForWebview(this._panel.webview).then(html => {
  this._panel.webview.html = html;
});


    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public dispose() {
    SettingsPanel.currentPanel = undefined;

    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const nonce = getNonce();
    const config = vscode.workspace.getConfiguration('spiderScreenshot');
    const folder = config.get<string>('screenshotFolder') || '';
    const imgurClientId = config.get<string>('imgurClientId') || '';
    const autoScreenshot = config.get<boolean>('autoScreenshot') || false;

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
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'save':
            const config = vscode.workspace.getConfiguration('spiderScreenshot');

            await config.update('screenshotFolder', message.folder, vscode.ConfigurationTarget.Global);
            await config.update('imgurClientId', message.imgurClientId, vscode.ConfigurationTarget.Global);
            await config.update('autoScreenshot', message.autoScreenshot, vscode.ConfigurationTarget.Global);

            vscode.window.showInformationMessage('Settings saved successfully!');
            break;

          case 'pickFolder':
            const folders = await vscode.window.showOpenDialog({
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
      },
      undefined,
      this._disposables
    );
  }
}
