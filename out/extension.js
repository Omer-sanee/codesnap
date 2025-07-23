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
const node_fetch_1 = __importDefault(require("node-fetch"));
const SettingsPanel_1 = __importDefault(require("./SettingsPanel"));
const TRIAL_FILE = path.join(os.homedir(), '.codesnap_trial.json');
const HISTORY_DIR = path.join(os.homedir(), 'codesnap_history');
const HISTORY_DIR = path.join(os.homedir(), 'codesnap_history');
const BACKUP_DIR = path.join(os.homedir(), 'codesnap_backups');
const LOG_FILE = path.join(os.homedir(), 'codesnap_logs.txt');
// Encryption helpers
function encrypt(content) {
    return Buffer.from(content, 'utf-8').toString('base64');
}
function decrypt(encoded) {
    return Buffer.from(encoded, 'base64').toString('utf-8');
}
// Trial management
function isTrialExpired() {
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
function logEvent(message) {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
}
function showStatusBar(message) {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBar.text = message;
    statusBar.show();
    setTimeout(() => statusBar.dispose(), 3000);
}
// Snapshots
function saveSnapshot(code, fileName) {
    if (!fs.existsSync(HISTORY_DIR))
        fs.mkdirSync(HISTORY_DIR);
    const time = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(HISTORY_DIR, `${fileName}-${time}.txt`);
    fs.writeFileSync(filePath, encrypt(code));
    logEvent(`Saved snapshot: ${filePath}`);
    return filePath;
}
// Core features
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
    if (!files.length)
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
    if (!files.length) {
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
                    const range = new vscode.Range(0, 0, editor.document.lineCount, 0);
                    edit.replace(editor.document.uri, range, content);
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
    const config = vscode.workspace.getConfiguration('codesnap');
    const dir = config.get('screenshotDirectory') || path.join(os.homedir(), 'SpiderScreenshots');
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, fileName);
}
function uploadToImgur(imagePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = vscode.workspace.getConfiguration('codesnap').get('imgurClientId');
        if (!apiKey) {
            vscode.window.showWarningMessage('Imgur Client ID not set in settings.');
            return;
        }
        const image = fs.readFileSync(imagePath, { encoding: 'base64' });
        const response = yield (0, node_fetch_1.default)('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: {
                Authorization: `Client-ID ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image })
        });
        const data = yield response.json();
        if (data.success) {
            yield vscode.env.clipboard.writeText(data.data.link);
            vscode.window.showInformationMessage('📤 Uploaded to Imgur! URL copied to clipboard.');
        }
        else {
            vscode.window.showErrorMessage('❌ Imgur upload failed.');
        }
    });
}
function activate(context) {
    let validLicense = context.globalState.get('spiderLicenseKey') === 'SPIDERPRO-2025-UNLOCKED';
    const commands = [
        vscode.commands.registerCommand('spiderScreenshot.settings', () => {
            SettingsPanel_1.default.show(context.extensionUri);
        }),
        vscode.commands.registerCommand('codesnap.enterLicenseKey', () => __awaiter(this, void 0, void 0, function* () {
            const key = yield vscode.window.showInputBox({ prompt: 'Enter your Spider Screenshot Pro License Key', ignoreFocusOut: true });
            if (!key)
                return vscode.window.showWarningMessage('❌ License key not provided.');
            if (key === 'SPIDERPRO-2025-UNLOCKED') {
                validLicense = true;
                context.globalState.update('spiderLicenseKey', key);
                vscode.window.showInformationMessage('✅ License accepted! Pro features unlocked.');
            }
            else {
                vscode.window.showErrorMessage('🚫 Invalid license.');
            }
        })),
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
        vscode.commands.registerCommand('codesnap.showLogs', showLogs),
        vscode.commands.registerCommand('codesnap.showSaveLocation', () => {
            vscode.window.showInformationMessage(`📁 Your snapshots are saved in:\n${HISTORY_DIR}`);
        })
    ];
    const autoSaveListener = vscode.workspace.onDidSaveTextDocument((document) => __awaiter(this, void 0, void 0, function* () {
        const config = vscode.workspace.getConfiguration('codesnap');
        const autoSnap = config.get('autoScreenshotOnSave') || false;
        if (autoSnap) {
            const fileName = path.basename(document.fileName).replace(/[^a-z0-9]/gi, '_');
            saveSnapshot(document.getText(), fileName);
            showStatusBar('📸 Auto snapshot saved');
        }
    }));
    context.subscriptions.push(...commands, autoSaveListener);
    showWelcomeMessage();
    if (validLicense) {
        vscode.window.showInformationMessage('🟢 Spider Pro is active!');
    }
    else {
        vscode.window.showWarningMessage('🟡 Pro features are locked.');
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map