// Registers the bundled `dotnet new` item templates (templates/) so C# Dev Kit
// lists them in its "New .NET File" picker. Dev Kit has no VS Code contribution
// point for templates; it reads whatever is installed with `dotnet new install`.
const vscode = require('vscode');
const path = require('path');
const { execFile } = require('child_process');

const STATE_KEY = 'jerrycurl.installedTemplates';

function dotnet(args, log) {
  return new Promise((resolve, reject) => {
    execFile('dotnet', args, { timeout: 120_000 }, (err, stdout, stderr) => {
      log.appendLine(`> dotnet ${args.join(' ')}`);
      if (stdout) log.appendLine(stdout.trimEnd());
      if (stderr) log.appendLine(stderr.trimEnd());
      err ? reject(err) : resolve(stdout);
    });
  });
}

async function installTemplates(context, log, force) {
  const templatesPath = path.join(context.extensionPath, 'templates');
  const version = context.extension.packageJSON.version;
  const previous = context.globalState.get(STATE_KEY);

  if (!force && previous?.path === templatesPath && previous?.version === version) return;

  // Folder installs reference the folder in place, and the extension folder
  // changes with every version, so drop the old registration first.
  if (previous?.path && previous.path !== templatesPath) {
    await dotnet(['new', 'uninstall', previous.path], log).catch(() => {});
  }

  try {
    await dotnet(['new', 'install', templatesPath, '--force'], log);
    await context.globalState.update(STATE_KEY, { path: templatesPath, version });
  } catch (err) {
    log.appendLine(`Failed to install Jerrycurl item templates: ${err.message}`);
    if (force) {
      vscode.window.showErrorMessage(
        'Jerrycurl: could not install the .cssql item templates. Is the .NET SDK on your PATH? See the "Jerrycurl" output for details.'
      );
    }
    return;
  }
  if (force) vscode.window.showInformationMessage('Jerrycurl: .cssql item templates installed.');
}

function activate(context) {
  const log = vscode.window.createOutputChannel('Jerrycurl');
  context.subscriptions.push(
    log,
    vscode.commands.registerCommand('jerrycurl.installTemplates', () => installTemplates(context, log, true))
  );
  installTemplates(context, log, false);
}

function deactivate() {}

module.exports = { activate, deactivate };
