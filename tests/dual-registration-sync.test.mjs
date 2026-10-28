import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { register } from 'node:module';
import { GoogleAuth } from 'google-auth-library';
import { registrationSheetHeaders } from '../lib/google-sheets.ts';
import { registrationWikiColumns } from '../lib/yandex-wiki.ts';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='next/server')return {url:'data:text/javascript,export function after(callback){globalThis.__dualSyncAfter.push(callback)}',shortCircuit:true};if(s.startsWith('@/lib/'))return n(new URL(s.slice(6)+'.ts',${JSON.stringify(new URL('../lib/',import.meta.url).href)}).href,c);if(['./google-sheets','./registration-store','./registration-google-sync','./registration-wiki-sync','./yandex-wiki'].includes(s))return n(s+'.ts',c);return n(s,c);}`),import.meta.url);

test('dual sync runs independent queues: Google failure cannot block Wiki, Wiki failure cannot block Google, retries retain all records', async () => {
 const dir=await mkdtemp('/private/tmp/dual-sync-');const oldFetch=globalThis.fetch,oldAuth=GoogleAuth.prototype.getClient;
 const envKeys=['REGISTRATIONS_DATA_DIR','GOOGLE_SERVICE_ACCOUNT_KEY_FILE','GOOGLE_SHEETS_SPREADSHEET_ID','GOOGLE_SHEETS_TAB','YANDEX_WIKI_OAUTH_TOKEN','YANDEX_WIKI_ORG_ID','YANDEX_WIKI_GRID_ID','YANDEX_WIKI_ORG_TYPE'];
 const oldEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
 let fail='google';const googleRows=[],wikiRows=[];
 try {
  Object.assign(process.env,{REGISTRATIONS_DATA_DIR:dir,GOOGLE_SERVICE_ACCOUNT_KEY_FILE:dir+'/fixture.json',GOOGLE_SHEETS_SPREADSHEET_ID:'test_spreadsheet_id_123456',GOOGLE_SHEETS_TAB:'Заявки сайта',YANDEX_WIKI_OAUTH_TOKEN:'test-wiki-token-not-real',YANDEX_WIKI_ORG_ID:'test-org',YANDEX_WIKI_ORG_TYPE:'cloud',YANDEX_WIKI_GRID_ID:'3bb263e4-233a-41a0-a79f-5e07bb904c7a'});
  GoogleAuth.prototype.getClient=async()=>({getAccessToken:async()=>({token:'test-google-token-not-real'})});
  globalThis.fetch=async(url,init={})=>{
   const provider=url.startsWith('https://sheets.googleapis.com/')?'google':url.startsWith('https://api.wiki.yandex.net/')?'wiki':null;
   assert(provider,'No credential-bearing request to an unexpected host');
   if(provider===fail)return Response.json({}, {status:403});
   if(provider==='google') {
    if(url.includes('?fields='))return Response.json({sheets:[{properties:{sheetId:1,title:'Заявки сайта',gridProperties:{rowCount:1000,columnCount:6}}}]});
    const decoded=decodeURIComponent(url);
    if(decoded.includes('!A2:A'))return Response.json({values:googleRows.map(row=>[row[0]])});
    if(decoded.includes('!A1:F1'))return Response.json({values:[registrationSheetHeaders]});
    if(decoded.includes(':append')){const rows=JSON.parse(init.body).values;googleRows.push(...rows);return Response.json({updates:{updatedRows:rows.length}});}
   } else {
    if(url.endsWith('/rows')){const rows=JSON.parse(init.body).rows;wikiRows.push(...rows.map((row,i)=>({id:String(wikiRows.length+i),row:registrationWikiColumns.map(c=>row[c.slug])})));return Response.json({});}
    return Response.json({revision:'1',structure:{columns:registrationWikiColumns},rows:wikiRows});
   }
   throw Error('Unexpected test request');
  };
  const {addRegistration,readRegistrations}=await import('../lib/registration-store.ts');
  const {syncRegistrationDestinations,registrationSyncConfigured}=await import('../lib/registration-sync.ts');
  const {googleSheetsStatus}=await import('../lib/registration-google-sync.ts');
  const {yandexWikiStatus}=await import('../lib/registration-wiki-sync.ts');
  await addRegistration({requestId:randomUUID(),name:'Первый участник',phone:'+79999999991',company:'=1+1',consent:true});
  assert(registrationSyncConfigured());await syncRegistrationDestinations();
  assert.equal(googleRows.length,0);assert(googleSheetsStatus().error);assert.equal(wikiRows.length,1);assert.equal(yandexWikiStatus().error,'');
  fail='wiki';await addRegistration({requestId:randomUUID(),name:'Второй участник',phone:'+79999999992',company:'',consent:true});await syncRegistrationDestinations();
  assert.equal(googleRows.length,2);assert.equal(googleSheetsStatus().error,'');assert(yandexWikiStatus().error);assert.equal(wikiRows.length,1);
  fail=null;await syncRegistrationDestinations();assert.equal(googleRows.length,2);assert.equal(wikiRows.length,2);assert.equal(googleSheetsStatus().added,0);assert.equal(yandexWikiStatus().added,1);
  assert.equal((await readRegistrations()).length,2);assert.equal(JSON.parse(await readFile(dir+'/registrations.json','utf8')).registrations.length,2);
  globalThis.__dualSyncAfter=[];
  const {POST}=await import('../app/api/registrations/route.ts');
  fail='google';
  const response=await POST(new Request('http://localhost/api/registrations',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({requestId:randomUUID(),name:'Автоматическая отправка',phone:'+79999999993',company:'',consent:true})}));
  assert.equal(response.status,201);assert.equal((await response.json()).success,true);
  assert.equal((await readRegistrations()).length,3);assert.equal(globalThis.__dualSyncAfter.length,1);
  await globalThis.__dualSyncAfter[0]();
  assert.equal(wikiRows.length,3);assert.equal(googleRows.length,2);assert(googleSheetsStatus().error);assert.equal(yandexWikiStatus().error,'');
  delete globalThis.__dualSyncAfter;
  assert(!JSON.stringify([googleSheetsStatus(),yandexWikiStatus()]).includes('test-google-token'));assert(!JSON.stringify([googleSheetsStatus(),yandexWikiStatus()]).includes('test-wiki-token'));
 } finally {globalThis.fetch=oldFetch;GoogleAuth.prototype.getClient=oldAuth;for(const key of envKeys)if(oldEnv[key]===undefined)delete process.env[key];else process.env[key]=oldEnv[key];await rm(dir,{recursive:true,force:true});}
});
