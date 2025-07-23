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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const node_fetch_1 = __importDefault(require("node-fetch")); // Ensure this is included in your package.json
const SettingsPanel_1 = __importDefault(require("./SettingsPanel"));
const TRIAL_FILE = path.join(os.homedir(), '.codesnap_trial.json');
const HISTORY_DIR = path.join(os.homedir(), 'codesnap_history');
const BACKUP_DIR = path.join(os.homedir(), 'codesnap_backups');
const LOG_FILE = path.join(os.homedir(), 'codesnap_logs.txt');
function encrypt(content) {
    return Buffer.from(content, 'utf-8').toString('base64');
}
function decrypt(encoded) {
    return Buffer.from(encoded, 'base64').toString('utf-8');
}
function isTrialExpired() {
    if (!fs.existsSync(TRIAL_FILE)) {
        fs.writeFileSync(TRIAL_FILE, JSON.stringify({ startedAt: new Date().toISOString() }, null, 2));
        return false;
    }
    const data = JSON.parse(fs.readFileSync(TRIAL_FILE, 'utf-8'));
    const startDate = new Date(data.startedAt);
    const now = new Date();
    const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysPassed > 30;
}
function logEvent(message) {
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, entry);
}
function showStatusBar(message) {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBar.text = message;
    statusBar.show();
    setTimeout(() => statusBar.dispose(), 3000);
}
function saveSnapshot(code, fileName) {
    const time = new Date().toISOString().replace(/[:.]/g, '-');
    if (!fs.existsSync(HISTORY_DIR))
        fs.mkdirSync(HISTORY_DIR);
    const encrypted = encrypt(code);
    const filePath = path.join(HISTORY_DIR, `${fileName}-${time}.txt`);
    fs.writeFileSync(filePath, encrypted);
    logEvent(`Saved snapshot: ${filePath}`);
    return filePath;
}
function showWelcomeMessage() {
    vscode.window.showInformationMessage('🎉 Spider Screenshot Activated!');
}
function openSavedFolder() {
    if (!fs.existsSync(HISTORY_DIR))
        fs.mkdirSync(HISTORY_DIR);
    vscode.env.openExternal(vscode.Uri.file(HISTORY_DIR));
}
function showLatestSnapshot() {
    if (!fs.existsSync(HISTORY_DIR))
        return;
    const files = fs.readdirSync(HISTORY_DIR).sort().reverse();
    if (files.length === 0)
        return;
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
    if (files.length === 0) {
        vscode.window.showInformationMessage('No code snapshots found.');
        return;
    }
    vscode.window.showQuickPick(files, { placeHolder: '📄 Select snapshot' }).then(file => {
        if (!file)
            return;
        const filePath = path.join(HISTORY_DIR, file);
        const content = decrypt(fs.readFileSync(filePath, 'utf-8'));
        vscode.window.showInformationMessage(`📂 What do you want to do with ${file}?`, 'Open', 'Delete', 'Restore').then(action => {
            if (action === 'Open') {
                vscode.workspace.openTextDocument({ content, language: 'plaintext' }).then(doc => vscode.window.showTextDocument(doc));
            }
            else if (action === 'Delete') {
                fs.unlinkSync(filePath);
                logEvent(`Deleted snapshot: ${filePath}`);
                vscode.window.showInformationMessage(`🗑 Deleted ${file}`);
            }
            else if (action === 'Restore') {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const edit = new vscode.WorkspaceEdit();
                    const doc = editor.document;
                    const range = new vscode.Range(0, 0, doc.lineCount, 0);
                    edit.replace(doc.uri, range, content);
                    vscode.workspace.applyEdit(edit);
                }
            }
        });
    });
}
function backupAllSnapshots() {
    if (!fs.existsSync(BACKUP_DIR))
        fs.mkdirSync(BACKUP_DIR);
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
function getSavePath(fileName) {
    const customDir = vscode.workspace.getConfiguration('codesnap').get('screenshotDirectory');
    const saveDir = customDir || path.join(os.homedir(), 'SpiderScreenshots');
    if (!fs.existsSync(saveDir))
        fs.mkdirSync(saveDir, { recursive: true });
    return path.join(saveDir, fileName);
}
async function uploadToImgur(imagePath) {
    const apiKey = vscode.workspace.getConfiguration('codesnap').get('imgurClientId');
    if (!apiKey) {
        vscode.window.showWarningMessage('Imgur Client ID not set in settings.');
        return;
    }
    const image = fs.readFileSync(imagePath, { encoding: 'base64' });
    const response = await (0, node_fetch_1.default)('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
            Authorization: `Client-ID ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image })
    });
    const data = await response.json();
    if (data.success) {
        vscode.env.clipboard.writeText(data.data.link);
        vscode.window.showInformationMessage('📤 Uploaded to Imgur! URL copied to clipboard.');
    }
    else {
        vscode.window.showErrorMessage('❌ Imgur upload failed.');
    }
}
function activate(context) {
    let validLicense = false;
    const savedKey = context.globalState.get('spiderLicenseKey');
    if (savedKey === 'SPIDERPRO-2025-UNLOCKED')
        validLicense = true;
    const commands = [
        vscode.commands.registerCommand('extension.openSettings', () => {
            SettingsPanel_1.default.show(context.extensionUri);
        }),
        vscode.commands.registerCommand('codesnap.enterLicenseKey', async () => {
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your Spider Screenshot Pro License Key',
                ignoreFocusOut: true
            });
            if (!key) {
                vscode.window.showWarningMessage('❌ License key not provided.');
                return;
            }
            if (key === 'SPIDERPRO-2025-UNLOCKED') {
                validLicense = true;
                context.globalState.update('spiderLicenseKey', key);
                vscode.window.showInformationMessage('✅ License accepted! Pro features unlocked.');
            }
            else {
                vscode.window.showErrorMessage('🚫 Invalid license.');
            }
        }),
        vscode.commands.registerCommand('codesnap.saveCodeHistory', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor)
                return;
            const code = editor.document.getText();
            const fileName = path.basename(editor.document.fileName).replace(/[^a-z0-9]/gi, '_');
            saveSnapshot(code, fileName);
            showStatusBar('✅ Snapshot saved');
        }),
        vscode.commands.registerCommand('codesnap.viewHistory', showHistoryPanel),
        vscode.commands.registerCommand('codesnap.openSnapshotFolder', openSavedFolder),
        vscode.commands.registerCommand('codesnap.showLatestSnapshot', showLatestSnapshot),
        vscode.commands.registerCommand('codesnap.backupSnapshots', backupAllSnapshots),
        vscode.commands.registerCommand('codesnap.showLogs', showLogs)
    ];
    const autoSaveListener = vscode.workspace.onDidSaveTextDocument(document => {
        const autoSnap = vscode.workspace.getConfiguration('codesnap').get('autoScreenshotOnSave');
        if (autoSnap) {
            const code = document.getText();
            const fileName = path.basename(document.fileName).replace(/[^a-z0-9]/gi, '_');
            saveSnapshot(code, fileName);
            showStatusBar('📸 Auto snapshot taken');
        }
    });
    context.subscriptions.push(...commands, autoSaveListener);
    showWelcomeMessage();
    if (validLicense) {
        vscode.window.showInformationMessage('🟢 Spider Pro is active!');
    }
    else {
        vscode.window.showWarningMessage('🟡 Pro features are locked.');
    }
    SettingsPanel_1.default.show(context.extensionUri, context);
}
function deactivate() { }
