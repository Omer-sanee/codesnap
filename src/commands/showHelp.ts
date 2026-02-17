import * as vscode from 'vscode';

export function showHelpNotification() {
  vscode.window.showInformationMessage(
    '🕷️ **Spider Screenshot Help**\n\n' +
    '**New Features in v1.4.0:**\n' +
    '• 🐛 Create Bug Reports (Command Palette)\n' +
    '• ☁️ Cloud Sync (Beta) - Enable in Settings\n' +
    '• 🚀 Join Pro Waitlist for lifetime discount\n\n' +
    '**Basic Commands:**\n' +
    '• Right-click code > Save Screenshot\n' +
    '• "CodeSnap: Save Code Snapshot"\n' +
    '• "CodeSnap: View Code History"\n' +
    '• Enable Auto Screenshot in Settings\n\n' +
    '**Need more help?** Click "Join Waitlist" for updates!',
    '⚙️ Open Settings', '📋 View History', '🚀 Join Waitlist'
  ).then(selection => {
    if (selection === '⚙️ Open Settings') {
      vscode.commands.executeCommand('spiderScreenshot.settings');
    } else if (selection === '📋 View History') {
      vscode.commands.executeCommand('codesnap.viewHistory');
    } else if (selection === '🚀 Join Waitlist') {
      vscode.env.openExternal(vscode.Uri.parse('https://bit.ly/4kGMUWu'));
    }
  });
}