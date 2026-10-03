import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../local-studio.js',import.meta.url),'utf8');
const {normalizeLoopbackBaseUrl,probeLocalStudio,discoverLocalStudioBaseUrl}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.chrome={storage:{local:{get:async()=>({lastLocalStudioBaseUrl:'https://evil.example'}),set:async()=>{},remove:async()=>{}}}};
test('discovery only accepts verified loopback instances in the configured range',async()=>{
 assert.equal(normalizeLoopbackBaseUrl('https://evil.example'),null);
 assert.equal(normalizeLoopbackBaseUrl('http://127.0.0.1:80'),null);
 assert.equal(normalizeLoopbackBaseUrl('http://localhost:32179/path'),'http://127.0.0.1:32179');
 globalThis.fetch=async()=>Response.json({status:'ready',version:'0.1.15'});
 assert.equal(await probeLocalStudio('http://127.0.0.1:32179'),null);
 const calls=[];
 globalThis.fetch=async url=>{calls.push(url);return Response.json({status:'ready',version:'0.1.15'},{headers:{'x-manimate-studio':url.includes(':32180/')?'local':'unrelated'}});};
 assert.equal(await discoverLocalStudioBaseUrl(),'http://127.0.0.1:32180');
 assert.equal(calls.length,20);assert.ok(calls.every(url=>url.endsWith('/api/status')));
 globalThis.fetch=async()=>{throw Error('offline');};assert.equal(await discoverLocalStudioBaseUrl(),null);
});
