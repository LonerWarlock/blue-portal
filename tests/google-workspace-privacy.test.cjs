const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const fragment = ({ children }) => jsx.jsx(jsx.Fragment, { children });

function load(file, imports = {}) {
  const result = ts.transpileModule(source(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    fileName: file, reportDiagnostics: true,
  });
  assert.deepEqual(result.diagnostics, [], `Syntax diagnostics in ${file}`);
  const module = { exports: {} };
  vm.runInNewContext(result.outputText, {
    module, exports: module.exports,
    require: name => {
      if (name === 'react/jsx-runtime') return jsx;
      assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`);
      return imports[name];
    },
  }, { filename: file });
  return module.exports;
}

const notice = load('app/privacy/GoogleWorkspaceNotice.tsx');
const page = load('app/privacy/page.tsx', {
  '@/app/components/PageLayout': { default: fragment },
  '@/app/components/PageBackground3D': { default: () => null },
  './GoogleWorkspaceNotice': notice,
});
const html = renderToStaticMarkup(jsx.jsx(page.default, {}));
const noticeHtml = renderToStaticMarkup(jsx.jsx(notice.default, {}));
const text = noticeHtml.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

test('Google notice is public server-rendered content with a working jump link and labelled heading', () => {
  assert.match(html, /href="#google-workspace"/);
  assert.match(html, /<section id="google-workspace" aria-labelledby="google-workspace-title"/);
  assert.match(html, /<h2 id="google-workspace-title"/);
  assert.doesNotMatch(source('app/privacy/GoogleWorkspaceNotice.tsx'), /["']use client["']/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Anchor IDs must be unique');
  assert.match(html, /dateTime="2026-10-15"/);
  assert.doesNotMatch(source('app/privacy/GoogleWorkspaceNotice.tsx'), /text-ink-faint/);
});

test('notice describes the five current scope grants and only supported Google actions', () => {
  const scopes = [...noticeHtml.matchAll(/https:\/\/www\.googleapis\.com\/auth\/([^<]+)/g)].map(match => match[1]);
  assert.deepEqual(scopes, ['gmail.modify', 'drive', 'calendar', 'contacts.readonly', 'tasks']);
  for (const label of ['Gmail', 'Google Drive', 'Google Calendar', 'Google Contacts', 'Google Tasks']) assert.ok(noticeHtml.includes(label));
  assert.match(text, /five permissions below together/);
  assert.match(text, /only the tools covered by your grant/);
  assert.match(text, /does not currently provide an email-sending tool/);
  assert.match(text, /Moving a file can change who can access it/);
  assert.match(text, /does not edit Docs or Sheets contents/);
  assert.match(text, /Invitation responses can notify other attendees/);
  assert.match(text, /does not create, edit, or delete contacts/);
  assert.match(text, /does not provide bulk clearing or task-list deletion/);
  assert.match(text, /action-approval flow, including in voice mode/);
});

test('Google content processing is disclosed separately from local execution and website processors', () => {
  assert.match(text, /Google content retrieved for a request can be included in prompts, tool results, and conversation context/);
  assert.match(text, /AI engine, model gateway, and underlying model provider/);
  assert.match(text, /does not mean AI processing stays on your device/);
  assert.match(text, /does not promise identical no-training or zero-retention terms/);
  assert.match(text, /Website analytics, advertising, and payment services are not recipients/);
  assert.match(noticeHtml, /href="https:\/\/developers\.google\.com\/terms\/api-services-user-data-policy"/);
  assert.match(text, /not a claim that Google has verified or certified Blue/);
});

test('encrypted credentials are distinguished from retained ordinary conversations and engine history', () => {
  assert.match(text, /tokens are stored locally in Blue's encrypted credential store/);
  assert.match(text, /tokens are kept out of model prompts and tool results/);
  assert.match(text, /Ordinary conversation state is not encrypted by Blue's credential-store mechanism/);
  assert.match(text, /no fixed automatic deletion period/);
  assert.match(text, /local deletion cannot guarantee deletion of those copies/);
  assert.match(text, /not a claim that all conversation data is encrypted at rest or end-to-end encrypted/);
});

test('disconnect, Google-side revocation and deletion are separate user controls', () => {
  assert.match(text, /Connections, find Google Workspace, and choose Disconnect/);
  assert.match(text, /does not undo a Google action already accepted or completed/);
  assert.match(text, /Disconnecting inside Blue alone does not perform this Google-side revocation/);
  assert.match(noticeHtml, /href="https:\/\/myaccount\.google\.com\/connections"/);
  assert.match(text, /does not guarantee deletion of separate coding-engine histories, backups, Google originals, or provider-held copies/);
  assert.match(noticeHtml, /href="mailto:team\.imergene@gmail\.com"/);
  assert.match(text, /Do not include passwords, access tokens, or private message contents/);
});

test('existing website disclosures and contacts are retained alongside the Google-specific retention limits', () => {
  for (const preserved of ['PayU India', 'Cashfree Payments', 'PostHog Inc.', 'Meta Platforms', 'Om Karande', 'Soham Phatak', 'Grievance Email:']) assert.ok(html.includes(preserved));
  assert.match(html, /specific retention and deletion limits/);
  assert.match(html, /personal information held by IMERGENE/);
  assert.doesNotMatch(html, /contractually bound Data Processors/);
  assert.match(html, /href="https:\/\/blue\.imergene\.in"/);
  assert.doesNotMatch(html, /blue-by-imergene\.vercel\.app/);
  assert.match(source('app/components/Footer.tsx'), /label: "Privacy Policy", href: "\/privacy"/);
});

test('privacy metadata remains canonical, public and describes the Google connection', () => {
  const metadata = load('app/privacy/layout.tsx', {
    '@/lib/seo': { createPageMetadata: (path, title, description) => ({ path, title, description }) },
  }).metadata;
  assert.equal(metadata.path, '/privacy');
  assert.match(metadata.description, /Google Workspace access, AI-provider processing/);
  assert.equal(metadata.robots, undefined);
  assert.match(source('lib/seo.ts'), /SITE_URL = 'https:\/\/blue\.imergene\.in'/);
});

test('security and services copy does not contradict cloud processing or promise universal privacy properties', () => {
  const security = source('app/security/page.tsx');
  const services = source('app/services/page.tsx');
  const enterprise = source('app/enterprise/page.tsx');
  for (const content of [security, services, enterprise]) {
    assert.doesNotMatch(content, /Code never leaves your machine|title: "Zero Data Retention"|title: "No Model Training"|protected by end-to-end encryption|Encryption — End-to-end encryption|No Training Guarantee — Contractual guarantee|API keys are hashed before storage/);
    assert.doesNotMatch(content, /title: "No Training Guarantee"/);
    assert.match(content, /model provider/);
  }
  for (const content of [security, services]) {
    assert.match(content, /retention terms/);
    assert.match(content, /credential store/);
  }
  assert.match(security, /href="\/privacy#google-workspace"/);
  assert.match(source('app/terms/page.tsx'), /href="https:\/\/blue\.imergene\.in"/);
  assert.doesNotMatch(source('app/terms/page.tsx'), /blue-by-imergene\.vercel\.app/);
});
