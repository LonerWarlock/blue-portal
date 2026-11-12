// Prompt without putting secret values in shell history or a plaintext file.
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requiredSecrets } from './blue-proxy-worker.mjs';
const here = fileURLToPath(new URL('.', import.meta.url));
const cli = fileURLToPath(new URL('./node_modules/wrangler/bin/wrangler.js', import.meta.url));
if (process.platform === 'win32') {
  const gui = fileURLToPath(new URL('./upload-secrets-windows.ps1', import.meta.url));
  const child = spawn('powershell.exe', ['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',gui,'-NodePath',process.execPath,'-WranglerPath',cli],
    { cwd: here, stdio: 'inherit', windowsHide: true });
  const status = await new Promise((resolve,reject) => { child.once('error',reject); child.once('exit',resolve); });
  process.exit(typeof status === 'number' ? status : 1);
}
const values = {};
if (!process.stdin.isTTY) throw new Error('Run this command in your own interactive terminal.');
let muted = false;
const output = new Writable({ write(chunk, _encoding, next) { if (!muted) process.stdout.write(chunk); next(); } });
const terminal = readline.createInterface({ input: process.stdin, output, terminal: true });
try {
  console.log('Paste the SAME production values saved in Vercel. Input is hidden.');
  for (const name of requiredSecrets) {
    const value = await new Promise(resolve => {
      process.stdout.write(name + ': '); muted = true;
      terminal.question('', answer => { muted = false; process.stdout.write('\n'); resolve(answer.trim()); });
    });
    if (!value || name === 'BLUE_TASK_TICKET_SECRET' && value.length < 32) throw new Error('A required value is missing or too short. No secrets were uploaded.');
    values[name] = value;
  }
} finally { terminal.close(); }
const child = spawn(process.execPath, [cli, 'secret', 'bulk', '--config', 'wrangler.jsonc'], {
  cwd: here, stdio: ['pipe','inherit','inherit'], windowsHide: true
});
child.stdin.end(JSON.stringify(values));
const status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
for (const name of requiredSecrets) delete values[name];
if (status !== 0) process.exitCode = typeof status === 'number' ? status : 1;
