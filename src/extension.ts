import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import fetch from 'node-fetch';
import SettingsPanel from './SettingsPanel';
import { showHelpNotification } from './commands/showHelp'

const TRIAL_FILE = path.join(os.homedir(), '.codesnap_trial.json');
const HISTORY_DIR = path.join(os.homedir(), 'codesnap_history');
const BACKUP_DIR = path.join(os.homedir(), 'codesnap_backups');
const LOG_FILE = path.join(os.homedir(), 'codesnap_logs.txt');

// Encryption helpers
function encrypt(content: string): string {
  return Buffer.from(content, 'utf-8').toString('base64');
}
function decrypt(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

// Trial management
function isTrialExpired(): boolean {
  if (!fs.existsSync(TRIAL_FILE)) {
    fs.writeFileSync(TRIAL_FILE, JSON.stringify({ startedAt: new Date().toISOString() }, null, 2));
    return false;
  }
  const data = JSON.parse(fs.readFileSync(TRIAL_FILE, 'utf-8'));
  const startDate = new Date(data.startedAt);
  const now = new Date();
  return (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) > 30;
}

// Utilities
function logEvent(message: string) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
}
function showStatusBar(message: string) {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBar.text = message;
  statusBar.show();
  setTimeout(() => statusBar.dispose(), 3000);
}

// 🔐 USER ID SYSTEM
function getOrCreateUserId(context: vscode.ExtensionContext): string {
  let userId = context.globalState.get<string>('spiderUserId');

  if (!userId) {
    userId = `spider_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    context.globalState.update('spiderUserId', userId);
    logEvent(`New user created: ${userId}`);
  }

  return userId;
}

// ☁️ CLOUD SAVE FUNCTION
async function saveToCloud(userId: string, fileName: string, code: string) {
  try {
    // TODO: Replace with your actual backend URL
    const response = await fetch('https://your-backend-api.com/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        fileName,
        code,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error('Cloud save failed');
    }

    logEvent(`☁️ Cloud save success for ${fileName}`);
    return true;
  } catch (error) {
    logEvent(`❌ Cloud save error: ${error}`);
    return false;
  }
}

// 🧹 AUTO-CLEANUP FUNCTION (NEW)
function cleanupOldFiles() {
  try {
    const config = vscode.workspace.getConfiguration('codesnap');
    const maxSnapshots = config.get<number>('keepMaxSnapshots') || 200;
    
    // Clean snapshots
    if (fs.existsSync(HISTORY_DIR)) {
      const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.endsWith('.txt'))
        .map(f => ({
          name: f,
          path: path.join(HISTORY_DIR, f),
          time: fs.statSync(path.join(HISTORY_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > maxSnapshots) {
        const toDelete = files.slice(maxSnapshots);
        toDelete.forEach(f => {
          fs.unlinkSync(f.path);
          logEvent(`🧹 Auto-cleaned old snapshot: ${f.name}`);
        });
      }
    }

    // Clean bug reports (keep last 50)
    if (fs.existsSync(HISTORY_DIR)) {
      const reports = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => ({
          name: f,
          path: path.join(HISTORY_DIR, f),
          time: fs.statSync(path.join(HISTORY_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (reports.length > 50) {
        const toDelete = reports.slice(50);
        toDelete.forEach(f => {
          fs.unlinkSync(f.path);
          logEvent(`🧹 Auto-cleaned old report: ${f.name}`);
        });
      }
    }

    // Clean logs (keep under 1MB)
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > 1024 * 1024) { // 1MB
        const content = fs.readFileSync(LOG_FILE, 'utf-8');
        const lines = content.split('\n');
        const keepLines = lines.slice(-500); // Keep last 500 lines
        fs.writeFileSync(LOG_FILE, keepLines.join('\n'));
        logEvent('🧹 Auto-cleaned log file');
      }
    }
  } catch (error) {
    logEvent(`Cleanup error: ${error}`);
  }
}

// 📋 PRIVACY NOTICE (NEW)
function showPrivacyNotice(context: vscode.ExtensionContext) {
  const privacyAccepted = context.globalState.get<boolean>('privacyAccepted');
  const telemetry = vscode.workspace.getConfiguration('codesnap').get<boolean>('telemetry') !== false;
  
  if (!privacyAccepted && telemetry) {
    vscode.window.showInformationMessage(
      '🔒 **Spider Screenshot Privacy Notice**\n\n' +
      '• No personal data collected\n' +
      '• Anonymous User ID for feature usage\n' +
      '• Pro link clicks tracked via Bitly\n' +
      '• Cloud Sync is OPTIONAL (disabled by default)\n' +
      '• You can disable telemetry in settings\n\n' +
      'See README for full details.',
      'Accept', 'Learn More', 'Disable Telemetry'
    ).then(selection => {
      if (selection === 'Accept') {
        context.globalState.update('privacyAccepted', true);
      } else if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/Omer-sanee/codesnap#privacy'));
      } else if (selection === 'Disable Telemetry') {
        vscode.workspace.getConfiguration('codesnap').update('telemetry', false, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('📊 Telemetry disabled');
      }
    });
  }
}

// ⭐ REVIEW PROMPT (NEW)
async function promptForReview(context: vscode.ExtensionContext) {
  const snapshotsSaved = context.globalState.get<number>('snapshotsSaved') || 0;
  const lastPrompt = context.globalState.get<number>('lastReviewPrompt') || 0;
  const reviewDisabled = context.globalState.get<boolean>('reviewPromptDisabled') || false;
  const daysSinceLastPrompt = (Date.now() - lastPrompt) / (1000 * 60 * 60 * 24);
  
  // Prompt after 5 snapshots and at least 7 days since last prompt
  if (snapshotsSaved >= 5 && daysSinceLastPrompt > 7 && !reviewDisabled) {
    const action = await vscode.window.showInformationMessage(
      '⭐ **Enjoying Spider Screenshot?**\n\nLeave a review to support the project!',
      'Rate Now', 'Later', 'Don\'t Show Again'
    );
    
    if (action === 'Rate Now') {
      vscode.env.openExternal(vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=SpiderDev.spider-screenshot&ssr=false#review-details'));
      context.globalState.update('lastReviewPrompt', Date.now());
    } else if (action === 'Later') {
      context.globalState.update('lastReviewPrompt', Date.now());
    } else if (action === 'Don\'t Show Again') {
      context.globalState.update('reviewPromptDisabled', true);
    }
  }
}

// 🐛 BUG REPORT GENERATOR
function createBugReport() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor.');
    return;
  }

  const document = editor.document;
  const selection = editor.selection;

  const selectedCode = selection && !selection.isEmpty
    ? document.getText(selection)
    : document.getText();

  const fileName = path.basename(document.fileName);
  const language = document.languageId;
  const osInfo = os.platform();
  const vscodeVersion = vscode.version;
  const timestamp = new Date().toISOString();

  const reportContent = `# 🐞 Bug Report

**File:** ${fileName}  
**Language:** ${language}  
**OS:** ${osInfo}  
**VS Code:** ${vscodeVersion}  
**Date:** ${timestamp}  

---

## 📸 Description
(Write what happened here)

---

## 💻 Code Snippet

\`\`\`${language}
${selectedCode}
\`\`\`

---

## 🔍 Steps to Reproduce
1. 
2. 
3. 

## ✅ Expected Behavior


## ❌ Actual Behavior


## 📷 Screenshots
(If applicable, add screenshots here)
`;

  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR);
  }

  const reportPath = path.join(
    HISTORY_DIR,
    `bug-report-${fileName.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.md`
  );

  fs.writeFileSync(reportPath, reportContent);

  vscode.workspace.openTextDocument(reportPath).then(doc => {
    vscode.window.showTextDocument(doc);
  });

  vscode.window.showInformationMessage('🐞 Bug report created successfully.');
  logEvent(`Bug report created: ${reportPath}`);
}

// Snapshots with size limit (UPDATED)
function saveSnapshot(code: string, fileName: string, context?: vscode.ExtensionContext) {
  // Check file size (limit to 1MB)
  const sizeInBytes = Buffer.byteLength(code, 'utf-8');
  const maxSize = (vscode.workspace.getConfiguration('codesnap').get<number>('maxSnapshotSize') || 1) * 1024 * 1024;
  
  if (sizeInBytes > maxSize) {
    vscode.window.showWarningMessage(`⚠️ File too large (${(sizeInBytes/1024/1024).toFixed(2)}MB). Max size: ${maxSize/1024/1024}MB`);
    return null;
  }
  
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR);
  const time = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(HISTORY_DIR, `${fileName}-${time}.txt`);
  fs.writeFileSync(filePath, encrypt(code));
  logEvent(`Saved snapshot: ${filePath}`);
  
  // Increment counter for review prompt
  if (context) {
    const count = context.globalState.get<number>('snapshotsSaved') || 0;
    context.globalState.update('snapshotsSaved', count + 1);
  }
  
  return filePath;
}

// Core features
function showWelcomeMessage() {
  vscode.window.showInformationMessage('🎉 Spider Screenshot Activated!');
}
function openSavedFolder() {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR);
  vscode.env.openExternal(vscode.Uri.file(HISTORY_DIR));
}
function showLatestSnapshot() {
  if (!fs.existsSync(HISTORY_DIR)) return;
  const files = fs.readdirSync(HISTORY_DIR).sort().reverse();
  if (!files.length) return;
  const file = files[0];
  const content = decrypt(fs.readFileSync(path.join(HISTORY_DIR, file), 'utf-8'));
  vscode.workspace.openTextDocument({ content, language: 'plaintext' }).then(doc => vscode.window.showTextDocument(doc));
}
function showHistoryPanel() {
  if (!fs.existsSync(HISTORY_DIR)) {
    vscode.window.showInformationMessage('No code snapshots found.');
    return;
  }
  const files = fs.readdirSync(HISTORY_DIR);
  if (!files.length) {
    vscode.window.showInformationMessage('No code snapshots found.');
    return;
  }
  vscode.window.showQuickPick(files, { placeHolder: '📄 Select snapshot' }).then(file => {
    if (!file) return;
    const filePath = path.join(HISTORY_DIR, file);
    const content = decrypt(fs.readFileSync(filePath, 'utf-8'));
    vscode.window.showInformationMessage(`📂 What do you want to do with ${file}?`, 'Open', 'Delete', 'Restore').then(action => {
      if (action === 'Open') {
        vscode.workspace.openTextDocument({ content, language: 'plaintext' }).then(doc => vscode.window.showTextDocument(doc));
      } else if (action === 'Delete') {
        fs.unlinkSync(filePath);
        logEvent(`Deleted snapshot: ${filePath}`);
        vscode.window.showInformationMessage(`🗑 Deleted ${file}`);
      } else if (action === 'Restore') {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const edit = new vscode.WorkspaceEdit();
          const range = new vscode.Range(0, 0, editor.document.lineCount, 0);
          edit.replace(editor.document.uri, range, content);
          vscode.workspace.applyEdit(edit);
        }
      }
    });
  });
}
function backupAllSnapshots() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);
  fs.cpSync(HISTORY_DIR, backupPath, { recursive: true });
  vscode.window.showInformationMessage('📦 Backup completed.');
}
function showLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    vscode.window.showInformationMessage('No logs yet.');
    return;
  }
  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  vscode.workspace.openTextDocument({ content, language: 'log' }).then(doc => vscode.window.showTextDocument(doc));
}
function getSavePath(fileName: string): string {
  const config = vscode.workspace.getConfiguration('codesnap');
  const dir = config.get<string>('screenshotDirectory') || path.join(os.homedir(), 'SpiderScreenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, fileName);
}
async function uploadToImgur(imagePath: string) {
  const apiKey = vscode.workspace.getConfiguration('codesnap').get('imgurClientId');
  if (!apiKey) {
    vscode.window.showWarningMessage('Imgur Client ID not set in settings.');
    return;
  }
  const image = fs.readFileSync(imagePath, { encoding: 'base64' });
  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      Authorization: `Client-ID ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ image })
  });
  const data = await response.json();
  if (data.success) {
    await vscode.env.clipboard.writeText(data.data.link);
    vscode.window.showInformationMessage('📤 Uploaded to Imgur! URL copied to clipboard.');
  } else {
    vscode.window.showErrorMessage('❌ Imgur upload failed.');
  }
}

export function activate(context: vscode.ExtensionContext) {
  let validLicense = context.globalState.get('spiderLicenseKey') === 'SPIDERPRO-2025-UNLOCKED';
  
  // 🔐 Initialize user ID
  const userId = getOrCreateUserId(context);
  
  // Log activation
  logEvent(`Extension activated for user: ${userId}`);

  // Show privacy notice (NEW)
  showPrivacyNotice(context);

  // Run initial cleanup (NEW)
  cleanupOldFiles();

  // Schedule weekly cleanup (NEW)
  setInterval(cleanupOldFiles, 7 * 24 * 60 * 60 * 1000); // Weekly

  const commands = [
    vscode.commands.registerCommand('spiderScreenshot.settings', () => {
      SettingsPanel.show(context.extensionUri);
    }),

    vscode.commands.registerCommand('codesnap.enterLicenseKey', async () => {
      const key = await vscode.window.showInputBox({ prompt: 'Enter your Spider Screenshot Pro License Key', ignoreFocusOut: true });
      if (!key) return vscode.window.showWarningMessage('❌ License key not provided.');
      if (key === 'SPIDERPRO-2025-UNLOCKED') {
        validLicense = true;
        context.globalState.update('spiderLicenseKey', key);
        vscode.window.showInformationMessage('✅ License accepted! Pro features unlocked.');
      } else {
        vscode.window.showErrorMessage('🚫 Invalid license.');
      }
    }),

    // 🚀 Upgrade to Pro command
    vscode.commands.registerCommand('spiderScreenshot.upgradeToPro', async () => {
      const action = await vscode.window.showInformationMessage(
        '🚀 Spider Screenshot Pro is coming soon! Join early access for a lifetime discount?',
        'Join Waitlist',
        'Maybe Later'
      );

      if (action === 'Join Waitlist') {
        vscode.env.openExternal(vscode.Uri.parse('https://bit.ly/4kGMUWu'));
      }
    }),

    // 🐛 Bug report command
    vscode.commands.registerCommand('spiderScreenshot.createBugReport', createBugReport),

    // ☁️ Save code with cloud sync (UPDATED with context)
    vscode.commands.registerCommand('codesnap.saveCodeHistory', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const config = vscode.workspace.getConfiguration('codesnap');
      const cloudEnabled = config.get<boolean>('enableCloudSync') || false;

      const code = editor.document.getText();
      const fileName = path.basename(editor.document.fileName).replace(/[^a-z0-9]/gi, '_');

      const saved = saveSnapshot(code, fileName, context);
      if (saved) {
        showStatusBar('✅ Snapshot saved');
        
        // Prompt for review after save (NEW)
        promptForReview(context);

        if (cloudEnabled) {
          const success = await saveToCloud(userId, fileName, code);
          if (success) {
            showStatusBar('☁️ Synced to cloud');
          } else {
            showStatusBar('⚠️ Cloud sync failed');
          }
        }
      }
    }),

    vscode.commands.registerCommand('codesnap.viewHistory', showHistoryPanel),
    vscode.commands.registerCommand('codesnap.openSnapshotFolder', openSavedFolder),
    vscode.commands.registerCommand('codesnap.showLatestSnapshot', showLatestSnapshot),
    vscode.commands.registerCommand('codesnap.backupSnapshots', backupAllSnapshots),
    vscode.commands.registerCommand('codesnap.showLogs', showLogs),
    vscode.commands.registerCommand('codesnap.showSaveLocation', () => {
      vscode.window.showInformationMessage(`📁 Your snapshots are saved in:\n${HISTORY_DIR}`);
    })
  ];

  // Auto-save listener with cloud sync (UPDATED)
  const autoSaveListener = vscode.workspace.onDidSaveTextDocument(async document => {
    const config = vscode.workspace.getConfiguration('codesnap');
    const autoSnap = config.get<boolean>('autoScreenshotOnSave') || false;
    const cloudEnabled = config.get<boolean>('enableCloudSync') || false;

    if (autoSnap) {
      const fileName = path.basename(document.fileName).replace(/[^a-z0-9]/gi, '_');
      const saved = saveSnapshot(document.getText(), fileName, context);
      
      if (saved) {
        showStatusBar('📸 Auto snapshot saved');
        
        if (cloudEnabled) {
          await saveToCloud(userId, fileName, document.getText());
        }
      }
    }
  });

  context.subscriptions.push(...commands, autoSaveListener);
  
  // Register help command
  context.subscriptions.push(
    vscode.commands.registerCommand('spiderScreenshot.showHelp', showHelpNotification)
  );
  
  showWelcomeMessage();

  // 🚀 Add status bar button for Pro upgrade
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(rocket) Spider Pro";
  statusBarItem.tooltip = "Upgrade to Spider Screenshot Pro - Early Access";
  statusBarItem.command = "spiderScreenshot.upgradeToPro";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  if (validLicense) {
    vscode.window.showInformationMessage('🟢 Spider Pro is active!');
  } else {
    vscode.window.showWarningMessage('🟡 Pro features are locked.');
  }
}

export function deactivate() {}