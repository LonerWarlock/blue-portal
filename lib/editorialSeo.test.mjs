import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as seo from './seo.ts';
const require=createRequire(import.meta.url), ts=require('typescript'), React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(p,imports){const module={exports:{}};const code=ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require(n){assert.ok(n in imports,n);return imports[n]}});return module.exports;}
const editorial=load('lib/editorialSeo.ts',{'./seo':seo});
const Link=({href,children,...props})=>React.createElement('a',{href,...props},children);
const JsonLd=({data})=>React.createElement('script',{type:'application/ld+json',dangerouslySetInnerHTML:{__html:JSON.stringify(data).replace(/</g,'\\u003c')}});
const components=load('app/components/EditorialMeta.tsx',{'react/jsx-runtime':require('react/jsx-runtime'),'next/link':{default:Link},'./JsonLd':{default:JsonLd},'@/lib/editorialSeo':editorial,'@/lib/seo':seo});
test('editorial graph uses existing organization and actual review date without inventing publication dates or ratings',()=>{
  const graph=editorial.editorialSchema('/guides/ai-agent-teams','AI agent teams');
  assert.equal(graph['@type'],'Article');assert.equal(graph.url,'https://blue.imergene.in/guides/ai-agent-teams');
  assert.equal(graph.author['@id'],'https://blue.imergene.in/#organization');assert.equal(graph.dateModified,'2026-11-14');
  assert.equal(graph.datePublished,undefined);assert.equal(graph.aggregateRating,undefined);
  assert.throws(()=>editorial.editorialSchema('https://untrusted.invalid','Title'));
});
test('visible byline matches schema date; comparison pages reuse their existing dated disclosure',()=>{
  const props={pagePath:'/docs',headline:'Blue docs: setup and first steps'};
  const html=renderToStaticMarkup(React.createElement(components.default,props));
  assert.match(html,/Content reviewed/);assert.match(html,/dateTime="2026-11-14"/i);assert.match(html,/dateModified/);assert.match(html,/\/about#identity/);
  const schemaOnly=renderToStaticMarkup(React.createElement(components.default,{...props,showByline:false}));
  assert.doesNotMatch(schemaOnly,/<p/);assert.match(schemaOnly,/application\/ld\+json/);
});
test('new breadcrumbs match visible navigation and link only to real canonical pages',()=>{
  const html=renderToStaticMarkup(React.createElement(components.EditorialBreadcrumb,{pagePath:'/docs',label:'Documentation'}));
  assert.match(html,/aria-label="Breadcrumb"/);assert.match(html,/aria-current="page"/);assert.match(html,/BreadcrumbList/);assert.match(html,/https:\/\/blue.imergene.in\/docs/);
});
test('editorial pages include metadata, consistent titles and no payment/runtime imports',()=>{
  for(const p of ['app/docs/page.tsx','app/guides/ai-agent-teams/page.tsx','app/guides/ai-coding-assistant-for-students/page.tsx','app/compare/codex/page.tsx','app/compare/emergent/page.tsx']){
    const source=read(p);assert.match(source,/<EditorialMeta /);assert.match(source,/Imergene/);
  }
  const component=read('app/components/EditorialMeta.tsx');assert.doesNotMatch(component,/redis|fetch\(|supabase|useEffect|use client|paypal|openrouter/i);
  assert.match(read('app/about/page.tsx'),/Om is the CEO and co-founder/);
});
