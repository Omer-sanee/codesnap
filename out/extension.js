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
const showHelp_1 = require("./commands/showHelp");
// Global variables
let globalContext;
const TRIAL_FILE = path.join(os.homedir(), '.codesnap_trial.json');
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
    try {
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
    }
    catch (error) {
        console.error('Failed to log event:', error);
    }
}
function showStatusBar(message) {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBar.text = message;
    statusBar.show();
    setTimeout(() => statusBar.dispose(), 3000);
}
// 🔐 USER ID SYSTEM
function getOrCreateUserId(context) {
    let userId = context.globalState.get('spiderUserId');
    if (!userId) {
        userId = `spider_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        context.globalState.update('spiderUserId', userId);
        logEvent(`New user created: ${userId}`);
    }
    return userId;
}
// ☁️ CLOUD SAVE FUNCTION
function saveToCloud(userId, fileName, code) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield (0, node_fetch_1.default)('https://your-backend-api.com/save', {
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
        }
        catch (error) {
            logEvent(`❌ Cloud save error: ${error}`);
            return false;
        }
    });
}
// 🧹 AUTO-CLEANUP FUNCTION
function cleanupOldFiles() {
    try {
        const config = vscode.workspace.getConfiguration('codesnap');
        const maxSnapshots = config.get('keepMaxSnapshots') || 200;
        if (fs.existsSync(HISTORY_DIR)) {
            const files = fs.readdirSync(HISTORY_DIR)
                .filter(f => f.endsWith('.txt') || f.endsWith('.md'))
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
                    logEvent(`🧹 Auto-cleaned old file: ${f.name}`);
                });
            }
        }
        if (fs.existsSync(LOG_FILE)) {
            const stats = fs.statSync(LOG_FILE);
            if (stats.size > 1024 * 1024) {
                const content = fs.readFileSync(LOG_FILE, 'utf-8');
                const lines = content.split('\n');
                const keepLines = lines.slice(-500);
                fs.writeFileSync(LOG_FILE, keepLines.join('\n'));
                logEvent('🧹 Auto-cleaned log file');
            }
        }
    }
    catch (error) {
        logEvent(`Cleanup error: ${error}`);
    }
}
// 📋 PRIVACY NOTICE
function showPrivacyNotice(context) {
    const privacyAccepted = context.globalState.get('privacyAccepted');
    const telemetry = vscode.workspace.getConfiguration('codesnap').get('telemetry') !== false;
    if (!privacyAccepted && telemetry) {
        vscode.window.showInformationMessage('🔒 **Spider Screenshot Privacy Notice**\n\n' +
            '• No personal data collected\n' +
            '• Anonymous User ID for feature usage\n' +
            '• Cloud Sync is OPTIONAL (disabled by default)\n' +
            '• You can disable telemetry in settings', 'Accept', 'Learn More', 'Disable Telemetry').then(selection => {
            if (selection === 'Accept') {
                context.globalState.update('privacyAccepted', true);
            }
            else if (selection === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/Omer-sanee/codesnap#privacy'));
            }
            else if (selection === 'Disable Telemetry') {
                vscode.workspace.getConfiguration('codesnap').update('telemetry', false, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('📊 Telemetry disabled');
            }
        });
    }
}
// ⭐ REVIEW PROMPT
function promptForReview(context) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const snapshotsSaved = context.globalState.get('snapshotsSaved') || 0;
            const lastPrompt = context.globalState.get('lastReviewPrompt') || 0;
            const reviewDisabled = context.globalState.get('reviewPromptDisabled') || false;
            const daysSinceLastPrompt = (Date.now() - lastPrompt) / (1000 * 60 * 60 * 24);
            if (snapshotsSaved >= 5 && daysSinceLastPrompt > 7 && !reviewDisabled) {
                const action = yield vscode.window.showInformationMessage('⭐ **Enjoying Spider Screenshot?**\n\nLeave a review to support the project!', 'Rate Now', 'Later', 'Don\'t Show Again');
                if (action === 'Rate Now') {
                    vscode.env.openExternal(vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=SpiderDev.spider-screenshot&ssr=false#review-details'));
                    context.globalState.update('lastReviewPrompt', Date.now());
                }
                else if (action === 'Later') {
                    context.globalState.update('lastReviewPrompt', Date.now());
                }
                else if (action === 'Don\'t Show Again') {
                    context.globalState.update('reviewPromptDisabled', true);
                }
            }
        }
        catch (error) {
            console.error('Review prompt error:', error);
        }
    });
}
// ===========================================
// REPORT BUG COMMAND
// ===========================================
function reportBug() {
    console.log('🐛 reportBug function called');
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('⚠️ No active editor. Open a file to create a bug report.');
            return;
        }
        const document = editor.document;
        const selection = editor.selection;
        let selectedCode = '';
        if (selection && !selection.isEmpty) {
            selectedCode = document.getText(selection);
        }
        else {
            selectedCode = document.getText();
        }
        const fileName = path.basename(document.fileName);
        const language = document.languageId;
        const osInfo = os.platform();
        const vscodeVersion = vscode.version;
        let userId = 'unknown';
        if (globalContext) {
            userId = getOrCreateUserId(globalContext);
        }
        vscode.window.showQuickPick(['🐞 Bug Report', '💡 Feature Request', '❓ Question', '📝 Other'], { placeHolder: 'Select report type' }).then(reportType => {
            if (!reportType)
                return;
            const type = reportType.split(' ')[1] || 'Bug Report';
            const reportContent = `# ${reportType}

**Generated:** ${new Date().toLocaleString()}
**File:** ${fileName}
**Language:** ${language}
**OS:** ${osInfo}
**VS Code:** ${vscodeVersion}
**Extension:** v1.6.0
**User ID:** ${userId}

---

## 📝 Description
<!-- Describe your issue or request here -->

---

## 💻 Code Snippet

\`\`\`${language}
${selectedCode}
\`\`\`

---

## 🔍 Steps to Reproduce (if applicable)
1. 
2. 
3. 

---

## ✅ Expected Behavior

---

## ❌ Actual Behavior

---

*Report generated by Spider Screenshot v1.6.0*
`;
            if (!fs.existsSync(HISTORY_DIR)) {
                fs.mkdirSync(HISTORY_DIR, { recursive: true });
            }
            const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_');
            const reportType_prefix = type.toLowerCase().replace(' ', '-');
            const reportFileName = `${reportType_prefix}-${safeFileName}-${Date.now()}.md`;
            const reportPath = path.join(HISTORY_DIR, reportFileName);
            fs.writeFileSync(reportPath, reportContent, 'utf8');
            console.log(`✅ Report created at: ${reportPath}`);
            vscode.workspace.openTextDocument(reportPath).then(doc => {
                vscode.window.showTextDocument(doc);
            });
            vscode.window.showInformationMessage(`✅ ${reportType} created successfully!`);
            logEvent(`Report created: ${reportFileName}`);
        });
    }
    catch (error) {
        console.error('❌ Error in reportBug:', error);
        vscode.window.showErrorMessage(`❌ Failed to create report: ${error}`);
    }
}
// 📸 ENHANCED: Save screenshot with options
function saveEnhancedSnapshot() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor.');
                return;
            }
            const document = editor.document;
            const selection = editor.selection;
            let codeToSave = '';
            if (selection && !selection.isEmpty) {
                codeToSave = document.getText(selection);
            }
            else {
                codeToSave = document.getText();
            }
            const fileName = path.basename(document.fileName).replace(/[^a-z0-9]/gi, '_');
            const description = yield vscode.window.showInputBox({
                prompt: 'Enter a description for this snapshot (optional)',
                placeHolder: 'e.g., Initial implementation, bug fix, etc.'
            });
            const saved = saveSnapshot(codeToSave, fileName, globalContext);
            if (saved) {
                showStatusBar('✅ Snapshot saved');
                if (description) {
                    const metadataPath = saved.replace('.txt', '.meta.json');
                    const metadata = {
                        description,
                        timestamp: new Date().toISOString(),
                        fileName,
                        originalPath: saved
                    };
                    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
                }
                promptForReview(globalContext);
                vscode.window.showInformationMessage(description ? `✅ Snapshot saved: "${description}"` : '✅ Snapshot saved');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error saving snapshot: ${error}`);
        }
    });
}
// 📂 ENHANCED: View history with metadata
function viewEnhancedHistory() {
    try {
        if (!fs.existsSync(HISTORY_DIR)) {
            vscode.window.showInformationMessage('No snapshots found.');
            return;
        }
        const files = fs.readdirSync(HISTORY_DIR)
            .filter(f => f.endsWith('.txt'));
        if (!files.length) {
            vscode.window.showInformationMessage('No snapshots found.');
            return;
        }
        const items = files.map(file => {
            const filePath = path.join(HISTORY_DIR, file);
            const stats = fs.statSync(filePath);
            const metadataPath = filePath.replace('.txt', '.meta.json');
            let description = '';
            if (fs.existsSync(metadataPath)) {
                try {
                    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
                    description = metadata.description || '';
                }
                catch (e) { }
            }
            const date = new Date(stats.mtime).toLocaleString();
            const size = (stats.size / 1024).toFixed(2) + ' KB';
            return {
                label: description ? `📄 ${description}` : `📄 ${file}`,
                description: `${date} (${size})`,
                file: file,
                path: filePath
            };
        }).reverse();
        vscode.window.showQuickPick(items, {
            placeHolder: '📄 Select snapshot',
            matchOnDescription: true
        }).then(item => {
            if (!item)
                return;
            const filePath = item.path;
            const content = decrypt(fs.readFileSync(filePath, 'utf-8'));
            vscode.window.showInformationMessage(`📂 What do you want to do with this snapshot?`, 'Open', 'Delete', 'Restore', 'Share').then(action => {
                if (action === 'Open') {
                    vscode.workspace.openTextDocument({ content, language: 'plaintext' }).then(doc => vscode.window.showTextDocument(doc));
                }
                else if (action === 'Delete') {
                    fs.unlinkSync(filePath);
                    const metaPath = filePath.replace('.txt', '.meta.json');
                    if (fs.existsSync(metaPath))
                        fs.unlinkSync(metaPath);
                    logEvent(`Deleted snapshot: ${filePath}`);
                    vscode.window.showInformationMessage(`🗑 Deleted`);
                }
                else if (action === 'Restore') {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        editor.edit(editBuilder => {
                            const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
                            editBuilder.replace(fullRange, content);
                        });
                    }
                }
                else if (action === 'Share') {
                    vscode.env.clipboard.writeText(content);
                    vscode.window.showInformationMessage('📋 Code copied to clipboard');
                }
            });
        });
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error viewing history: ${error}`);
    }
}
// Snapshots with size limit
function saveSnapshot(code, fileName, context) {
    try {
        const sizeInBytes = Buffer.byteLength(code, 'utf-8');
        const maxSize = (vscode.workspace.getConfiguration('codesnap').get('maxSnapshotSize') || 1) * 1024 * 1024;
        if (sizeInBytes > maxSize) {
            vscode.window.showWarningMessage(`⚠️ File too large (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB). Max size: ${maxSize / 1024 / 1024}MB`);
            return null;
        }
        if (!fs.existsSync(HISTORY_DIR)) {
            fs.mkdirSync(HISTORY_DIR, { recursive: true });
        }
        const time = new Date().toISOString().replace(/[:.]/g, '-');
        const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_');
        const filePath = path.join(HISTORY_DIR, `${safeFileName}-${time}.txt`);
        fs.writeFileSync(filePath, encrypt(code));
        logEvent(`Saved snapshot: ${filePath}`);
        if (context) {
            const count = context.globalState.get('snapshotsSaved') || 0;
            context.globalState.update('snapshotsSaved', count + 1);
        }
        return filePath;
    }
    catch (error) {
        logEvent(`Save snapshot error: ${error}`);
        return null;
    }
}
function showWelcomeMessage() {
    vscode.window.showInformationMessage('🎉 Spider Screenshot Activated!');
}
function openSavedFolder() {
    try {
        if (!fs.existsSync(HISTORY_DIR)) {
            fs.mkdirSync(HISTORY_DIR, { recursive: true });
        }
        vscode.env.openExternal(vscode.Uri.file(HISTORY_DIR));
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error opening folder: ${error}`);
    }
}
function showLatestSnapshot() {
    try {
        if (!fs.existsSync(HISTORY_DIR)) {
            vscode.window.showInformationMessage('No snapshots found.');
            return;
        }
        const files = fs.readdirSync(HISTORY_DIR)
            .filter(f => f.endsWith('.txt'))
            .sort()
            .reverse();
        if (!files.length) {
            vscode.window.showInformationMessage('No snapshots found.');
            return;
        }
        const file = files[0];
        const content = decrypt(fs.readFileSync(path.join(HISTORY_DIR, file), 'utf-8'));
        vscode.workspace.openTextDocument({ content, language: 'plaintext' }).then(doc => vscode.window.showTextDocument(doc));
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error showing latest snapshot: ${error}`);
    }
}
function backupAllSnapshots() {
    try {
        if (!fs.existsSync(HISTORY_DIR)) {
            vscode.window.showInformationMessage('No snapshots to backup.');
            return;
        }
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);
        const copyRecursive = (src, dest) => {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            const entries = fs.readdirSync(src, { withFileTypes: true });
            for (let entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);
                if (entry.isDirectory()) {
                    copyRecursive(srcPath, destPath);
                }
                else {
                    fs.copyFileSync(srcPath, destPath);
                }
            }
        };
        copyRecursive(HISTORY_DIR, backupPath);
        vscode.window.showInformationMessage('📦 Backup completed successfully.');
        logEvent(`Backup created: ${backupPath}`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error creating backup: ${error}`);
    }
}
function restoreFromBackup() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            vscode.window.showInformationMessage('No backups found.');
            return;
        }
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup-'))
            .sort()
            .reverse();
        if (!backups.length) {
            vscode.window.showInformationMessage('No backups found.');
            return;
        }
        vscode.window.showQuickPick(backups, { placeHolder: '📦 Select backup to restore' }).then(backup => {
            if (!backup)
                return;
            const backupPath = path.join(BACKUP_DIR, backup);
            if (fs.existsSync(HISTORY_DIR)) {
                fs.rmSync(HISTORY_DIR, { recursive: true, force: true });
            }
            const copyRecursive = (src, dest) => {
                if (!fs.existsSync(dest)) {
                    fs.mkdirSync(dest, { recursive: true });
                }
                const entries = fs.readdirSync(src, { withFileTypes: true });
                for (let entry of entries) {
                    const srcPath = path.join(src, entry.name);
                    const destPath = path.join(dest, entry.name);
                    if (entry.isDirectory()) {
                        copyRecursive(srcPath, destPath);
                    }
                    else {
                        fs.copyFileSync(srcPath, destPath);
                    }
                }
            };
            copyRecursive(backupPath, HISTORY_DIR);
            vscode.window.showInformationMessage('📦 Restore completed successfully.');
            logEvent(`Restored from backup: ${backup}`);
        });
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error restoring backup: ${error}`);
    }
}
function showLogs() {
    try {
        if (!fs.existsSync(LOG_FILE)) {
            vscode.window.showInformationMessage('No logs yet.');
            return;
        }
        const content = fs.readFileSync(LOG_FILE, 'utf-8');
        vscode.workspace.openTextDocument({ content, language: 'log' }).then(doc => vscode.window.showTextDocument(doc));
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error showing logs: ${error}`);
    }
}
function getSavePath(fileName) {
    const config = vscode.workspace.getConfiguration('codesnap');
    const dir = config.get('screenshotDirectory') || path.join(os.homedir(), 'SpiderScreenshots');
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, fileName);
}
function activate(context) {
    console.log('🕷️ Spider Screenshot Enhanced Edition Activating...');
    globalContext = context;
    let validLicense = context.globalState.get('spiderLicenseKey') === 'SPIDERPRO-2025-UNLOCKED';
    const userId = getOrCreateUserId(context);
    logEvent(`Extension activated for user: ${userId}`);
    showPrivacyNotice(context);
    cleanupOldFiles();
    setInterval(cleanupOldFiles, 7 * 24 * 60 * 60 * 1000);
    const disposables = [];
    // ===========================================
    // CRITICAL FIX: Register commands with error handling
    // ===========================================
    console.log('📝 Registering commands...');
    // Helper function to safely register commands
    function registerCommand(commandId, callback) {
        try {
            const disposable = vscode.commands.registerCommand(commandId, callback);
            disposables.push(disposable);
            console.log(`  ✅ Registered: ${commandId}`);
            return true;
        }
        catch (error) {
            console.error(`  ❌ Failed to register ${commandId}:`, error);
            return false;
        }
    }
    // SPIDER SCREENSHOT COMMANDS
    registerCommand('spiderScreenshot.settings', () => {
        SettingsPanel_1.default.show(context.extensionUri);
    });
    registerCommand('spiderScreenshot.upgradeToPro', () => __awaiter(this, void 0, void 0, function* () {
        const action = yield vscode.window.showInformationMessage('🚀 Spider Screenshot Pro is coming soon! Join early access?', 'Join Waitlist', 'Maybe Later');
        if (action === 'Join Waitlist') {
            vscode.env.openExternal(vscode.Uri.parse('https://bit.ly/4kGMUWu'));
        }
    }));
    registerCommand('spiderScreenshot.reportBug', () => {
        reportBug();
    });
    registerCommand('spiderScreenshot.showHelp', () => {
        (0, showHelp_1.showHelpNotification)();
    });
    // CODESNAP COMMANDS
    registerCommand('codesnap.saveCodeHistory', () => __awaiter(this, void 0, void 0, function* () {
        yield saveEnhancedSnapshot();
    }));
    registerCommand('codesnap.viewHistory', () => {
        viewEnhancedHistory();
    });
    registerCommand('codesnap.clearSnapshots', () => {
        if (fs.existsSync(HISTORY_DIR)) {
            fs.rmSync(HISTORY_DIR, { recursive: true, force: true });
            vscode.window.showInformationMessage('🗑 All snapshots cleared.');
            logEvent('All snapshots cleared');
        }
    });
    registerCommand('codesnap.backupSnapshots', () => {
        backupAllSnapshots();
    });
    registerCommand('codesnap.restoreBackup', () => {
        restoreFromBackup();
    });
    registerCommand('codesnap.openSnapshotFolder', () => {
        openSavedFolder();
    });
    registerCommand('codesnap.showLogs', () => {
        showLogs();
    });
    registerCommand('codesnap.showLatestSnapshot', () => {
        showLatestSnapshot();
    });
    registerCommand('codesnap.showSaveLocation', () => {
        vscode.window.showInformationMessage(`📁 Your snapshots are saved in:\n${HISTORY_DIR}`);
    });
    registerCommand('codesnap.enterLicenseKey', () => __awaiter(this, void 0, void 0, function* () {
        const key = yield vscode.window.showInputBox({
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
    }));
    // Auto-save listener
    const autoSaveListener = vscode.workspace.onDidSaveTextDocument((document) => __awaiter(this, void 0, void 0, function* () {
        const config = vscode.workspace.getConfiguration('codesnap');
        const autoSnap = config.get('autoScreenshotOnSave') || false;
        if (autoSnap) {
            const fileName = path.basename(document.fileName).replace(/[^a-z0-9]/gi, '_');
            saveSnapshot(document.getText(), fileName, context);
            showStatusBar('📸 Auto snapshot saved');
        }
    }));
    disposables.push(autoSaveListener);
    // Add all disposables to context.subscriptions
    context.subscriptions.push(...disposables);
    // Status bar
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(rocket) Spider Pro";
    statusBarItem.tooltip = "Upgrade to Spider Screenshot Pro - Early Access";
    statusBarItem.command = "spiderScreenshot.upgradeToPro";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    showWelcomeMessage();
    console.log('✅ Spider Screenshot Enhanced Edition Activated!');
    console.log(`   Total commands registered: ${disposables.length}`);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map