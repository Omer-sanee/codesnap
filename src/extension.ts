import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

const TRIAL_FILE = path.join(os.homedir(), '.codesnap_trial.json');
const HISTORY_DIR = path.join(os.homedir(), 'codesnap_history');

// Encode content (basic encryption using base64)
function encrypt(content: string): string {
  return Buffer.from(content, 'utf-8').toString('base64');
}

// Decode content
function decrypt(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

// Trial check
function isTrialExpired(): boolean {
  if (!fs.existsSync(TRIAL_FILE)) {
    fs.writeFileSync(
      TRIAL_FILE,
      JSON.stringify({ startedAt: new Date().toISOString() }, null, 2)
    );
    return false;
  }
const config = vscode.workspace.getConfiguration('codesnap');

const savePath = config.get<string>('savePath');
const imageFormat = config.get<string>('imageFormat');
const includeLineNumbers = config.get<boolean>('includeLineNumbers');
  const data = JSON.parse(fs.readFileSync(TRIAL_FILE, 'utf-8'));
  const startDate = new Date(data.startedAt);
  const now = new Date();
  const days = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return days > 30;
}

// Auto-delete old snapshots
function cleanOldFiles(dir: string, daysOld: number = 30) {
  if (!fs.existsSync(dir)) return;
  const now = Date.now();

  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    const ageDays = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > daysOld) fs.unlinkSync(filePath);
  });
}

// View snapshot history
function showHistoryPanel() {
  if (!fs.existsSync(HISTORY_DIR)) {
    vscode.window.showInformationMessage('No code snapshots found.');
    return;
  }

  const files = fs.readdirSync(HISTORY_DIR);
  if (files.length === 0) {
    vscode.window.showInformationMessage('No code snapshots found.');
    return;
  }

  vscode.window.showQuickPick(files, {
    placeHolder: '📄 Select a code snapshot to open or delete',
    canPickMany: false
  }).then(file => {
    if (!file) return;

    vscode.window.showInformationMessage("📂 What do you want to do with ${file}?", 'Open', 'Delete').then(action => {
      const filePath = path.join(HISTORY_DIR, file);
      if (action === 'Open') {
        const content = decrypt(fs.readFileSync(filePath, 'utf-8'));
        const doc = vscode.workspace.openTextDocument({ content, language: 'plaintext' });
        doc.then(d => vscode.window.showTextDocument(d));
      } else if (action === 'Delete') {
        fs.unlinkSync(filePath);
        vscode.window.showInformationMessage("🗑 Deleted ${file}");
      }
    });
  });
}

// Save snapshot (used in both command and auto-save)
function saveSnapshot(code: string, fileName: string) {
  const time = new Date().toISOString().replace(/[:.]/g, '-');

  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR);

  const encrypted = encrypt(code);
  const filePath = path.join(HISTORY_DIR, '${fileName}-${time}.txt');
  fs.writeFileSync(filePath, encrypted);
  return filePath;
}

export function activate(context: vscode.ExtensionContext) {
  if (isTrialExpired()) {
    vscode.window.showWarningMessage('🚫 Trial expired. Upgrade to Pro to continue. (Feature disabled)');
    // In the future, redirect to upgrade link here
    return;
  }

  cleanOldFiles(HISTORY_DIR, 30);

  // Manual command: Save snapshot
  const saveCommand = vscode.commands.registerCommand('codesnap.saveCodeHistory', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('No active editor.');
      return;
    }

    const code = editor.document.getText();
    const fileName = path.basename(editor.document.fileName).replace(/[^a-z0-9]/gi, '_');
    const savedPath = saveSnapshot(code, fileName);

    vscode.window.showInformationMessage("✅ Code snapshot saved to ${savedPath}");
  });

  // Manual command: View/delete snapshot history
  const historyCommand = vscode.commands.registerCommand('codesnap.viewHistory', () => {
    showHistoryPanel();
  });

  // Auto-save on file save
  const autoSaveListener = vscode.workspace.onDidSaveTextDocument(document => {
    const code = document.getText();
    const fileName = path.basename(document.fileName).replace(/[^a-z0-9]/gi, '_');
    const savedPath = saveSnapshot(code, fileName);
    console.log("📸 Auto-saved snapshot: ${savedPath}");
  });

  context.subscriptions.push(saveCommand, historyCommand, autoSaveListener);
}

export function deactivate() {}