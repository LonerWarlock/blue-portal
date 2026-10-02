// Bundle Blue's ACTUAL renderer, never its native main process/preload/engine.
// Commit the output assets: Portal deployment does not need the sibling source.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const portal = path.resolve(__dirname, '..');
const desktop = path.resolve(process.env.BLUE_DEMO_SOURCE || path.join(portal, '..', 'BlueV2', 'desktop'));
const esbuild = require(path.join(desktop, 'node_modules', 'esbuild'));
const output = path.join(portal, 'public', 'demos', 'blue-desktop');

async function build() {
  fs.mkdirSync(output, { recursive: true });
  const adapter = await esbuild.build({
    stdin: { contents: `import {createDemoBridge} from './demo/desktop/bridge'; window.blueDesktop=createDemoBridge({location:{search:document.documentElement.dataset.previewTheme?'?theme='+document.documentElement.dataset.previewTheme:window.location.search},matchMedia:window.matchMedia.bind(window)}, text=>{const el=document.getElementById('demo-notice');if(el)el.textContent=text;});`, resolveDir: portal },
    bundle: true, write: false, format: 'iife', target: 'es2020', minify: true,
  });
  await esbuild.build({
    entryPoints: [path.join(portal, 'demo', 'desktop', 'main.tsx')],
    bundle: true, outfile: path.join(output, 'app.js'), format: 'iife',
    target: 'es2020', minify: true, jsx: 'automatic', sourcemap: false,
    banner: { js: adapter.outputFiles[0].text },
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: {
      'blue-desktop-renderer': path.join(desktop, 'src', 'App.tsx'),
      'blue-desktop-styles': path.join(desktop, 'src', 'styles.css'),
      'react': path.join(desktop, 'node_modules', 'react'),
      'react-dom': path.join(desktop, 'node_modules', 'react-dom'),
    },
    nodePaths: [path.join(desktop, 'node_modules')],
    loader: { '.png': 'dataurl', '.woff2': 'dataurl' },
    legalComments: 'linked',
  });
  // srcdoc keeps the demo opaque without relaxing the site's anti-framing policy.
  // The only executable script is this exact, hash-allowlisted static bundle.
  const script = fs.readFileSync(path.join(output, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  const css = fs.readFileSync(path.join(output, 'app.css'), 'utf8').replace(/<\/style/gi, '<\\/style');
  const scriptHash = crypto.createHash('sha256').update(script).digest('base64');
  fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'">
<title>Blue Desktop — Interactive preview</title><style>${css}</style>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}#root{height:calc(100% - 30px)}.demo-notice{position:fixed;inset:auto 0 0;display:flex;align-items:center;height:30px;box-sizing:border-box;padding:0 12px;border-top:1px solid #bfd2ef;background:#edf4ff;color:#294263;font:11px/1.2 system-ui,sans-serif}.demo-notice strong{margin-right:9px;flex-shrink:0;font-size:9px;letter-spacing:.05em}.demo-notice span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style>
</head><body><div id="root"></div><footer class="demo-notice"><strong>INTERACTIVE PREVIEW</strong><span id="demo-notice" role="status">Example data only. No AI calls, credits, file access or account connection.</span></footer><script>${script}</script></body></html>`);
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(desktop, file))).digest('hex');
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({
    kind: 'isolated-example-demo', version: JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'))).version,
    renderer: 'Blue Desktop original React renderer; unmodified source',
    sourceHashes: { app: hash('src/App.tsx'), styles: hash('src/styles.css') },
    network: false, aiCalls: false, accountConnection: false, filesystemAccess: false,
  }, null, 2) + '\n');
  console.log('Built isolated Blue Desktop demo from its original renderer. No engine or native process bundled.');
}
build().catch(error => { console.error(error.message); process.exitCode = 1; });
