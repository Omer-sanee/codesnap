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
exports.showHelpNotification = showHelpNotification;
const vscode = __importStar(require("vscode"));
function showHelpNotification() {
    vscode.window.showInformationMessage('🕷️ **Spider Screenshot Help**\n\n' +
        '**New Features in v1.4.0:**\n' +
        '• 🐛 Create Bug Reports (Command Palette)\n' +
        '• ☁️ Cloud Sync (Beta) - Enable in Settings\n' +
        '• 🚀 Join Pro Waitlist for lifetime discount\n\n' +
        '**Basic Commands:**\n' +
        '• Right-click code > Save Screenshot\n' +
        '• "CodeSnap: Save Code Snapshot"\n' +
        '• "CodeSnap: View Code History"\n' +
        '• Enable Auto Screenshot in Settings\n\n' +
        '**Need more help?** Click "Join Waitlist" for updates!', '⚙️ Open Settings', '📋 View History', '🚀 Join Waitlist').then(selection => {
        if (selection === '⚙️ Open Settings') {
            vscode.commands.executeCommand('spiderScreenshot.settings');
        }
        else if (selection === '📋 View History') {
            vscode.commands.executeCommand('codesnap.viewHistory');
        }
        else if (selection === '🚀 Join Waitlist') {
            vscode.env.openExternal(vscode.Uri.parse('https://bit.ly/4kGMUWu'));
        }
    });
}
//# sourceMappingURL=showHelp.js.map