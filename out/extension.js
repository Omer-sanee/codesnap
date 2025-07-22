"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const fs = require("fs");
const os = require("os");
const path = require("path");
const TRIAL_FILE = path.join(os.homedir(), '.codesnap_trial.json');
const HISTORY_DIR = path.join(os.homedir(), 'codesnap_history');
const MAX_HISTORY_PER_FILE = 20;
// Check if 30-day trial expired
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
// Auto-delete old files
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
// Show saved history
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
                const content = fs.readFileSync(filePath, 'utf-8');
                const doc = vscode.workspace.openTextDocument({ content, language: 'plaintext' });
                doc.then(d => vscode.window.showTextDocument(d));
            }
            else if (action === 'Delete') {
                fs.unlinkSync(filePath);
                vscode.window.showInformationMessage('🗑 Deleted ${file}');
            }
        });
    });
}
function autoSaveSnapshot(document) {
    if (isTrialExpired())
        return;
    const code = document.getText();
    const baseName = path.basename(document.fileName).replace(/[^a-z0-9]/gi, '_');
    const time = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(HISTORY_DIR, '${baseName}-${time}.txt');
    if (!fs.existsSync(HISTORY_DIR))
        fs.mkdirSync(HISTORY_DIR);
    fs.writeFileSync(filePath, code);
    // Trim excess history for this file
    const historyFiles = fs
        .readdirSync(HISTORY_DIR)
        .filter(f => f.startsWith(baseName + '-'))
        .sort()
        .reverse();
    if (historyFiles.length > MAX_HISTORY_PER_FILE) {
        const toDelete = historyFiles.slice(MAX_HISTORY_PER_FILE);
        toDelete.forEach(f => fs.unlinkSync(path.join(HISTORY_DIR, f)));
    }
}
function activate(context) {
    if (isTrialExpired()) {
        vscode.window.showWarningMessage('🚫 Trial expired. Upgrade to Pro to continue.');
        return;
    }
    cleanOldFiles(HISTORY_DIR, 30);
    // Manual save command
    const saveCommand = vscode.commands.registerCommand('codesnap.saveCodeHistory', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor.');
            return;
        }
        autoSaveSnapshot(editor.document);
        vscode.window.showInformationMessage('✅ Code snapshot saved.');
    });
    // History viewer command
    const historyCommand = vscode.commands.registerCommand('codesnap.viewHistory', () => {
        showHistoryPanel();
    });
    // Auto-save on file save
    const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
        autoSaveSnapshot(document);
    });
    context.subscriptions.push(saveCommand, historyCommand, saveListener);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map