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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const TRIAL_FILE = path.join(os.homedir(), '.codesnap_trial.json');
const HISTORY_DIR = path.join(os.homedir(), 'codesnap_history');
// Encode content (basic encryption using base64)
function encrypt(content) {
    return Buffer.from(content, 'utf-8').toString('base64');
}
// Decode content
function decrypt(encoded) {
    return Buffer.from(encoded, 'base64').toString('utf-8');
}
// Trial check
function isTrialExpired() {
    if (!fs.existsSync(TRIAL_FILE)) {
        fs.writeFileSync(TRIAL_FILE, JSON.stringify({ startedAt: new Date().toISOString() }, null, 2));
        return false;
    }
    const data = JSON.parse(fs.readFileSync(TRIAL_FILE, 'utf-8'));
    const startDate = new Date(data.startedAt);
    const now = new Date();
    const days = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return days > 30;
}
// Auto-delete old snapshots
function cleanOldFiles(dir, daysOld = 30) {
    if (!fs.existsSync(dir))
        return;
    const now = Date.now();
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        const ageDays = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > daysOld)
            fs.unlinkSync(filePath);
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
        if (!file)
            return;
        vscode.window.showInformationMessage("📂 What do you want to do with ${file}?", 'Open', 'Delete').then(action => {
            const filePath = path.join(HISTORY_DIR, file);
            if (action === 'Open') {
                const content = decrypt(fs.readFileSync(filePath, 'utf-8'));
                const doc = vscode.workspace.openTextDocument({ content, language: 'plaintext' });
                doc.then(d => vscode.window.showTextDocument(d));
            }
            else if (action === 'Delete') {
                fs.unlinkSync(filePath);
                vscode.window.showInformationMessage("🗑 Deleted ${file}");
            }
        });
    });
}
// Save snapshot (used in both command and auto-save)
function saveSnapshot(code, fileName) {
    const time = new Date().toISOString().replace(/[:.]/g, '-');
    if (!fs.existsSync(HISTORY_DIR))
        fs.mkdirSync(HISTORY_DIR);
    const encrypted = encrypt(code);
    const filePath = path.join(HISTORY_DIR, '${fileName}-${time}.txt');
    fs.writeFileSync(filePath, encrypted);
    return filePath;
}
function activate(context) {
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
function deactivate() { }
