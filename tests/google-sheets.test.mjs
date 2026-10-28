import assert from 'node:assert/strict';
import test from 'node:test';
import { GoogleSheetsRegistrationExporter, registrationSheetHeaders } from '../lib/google-sheets.ts';

const record = (id, name = 'Анна') => ({ id, requestId:id, createdAt:'2026-10-26T10:00:00.000Z', name, phone:'+79991234567', company:'=IMPORTXML("https://example.invalid", "*")', consent:true });
function mockSheet({ existing = [], wrongHeaders = false, failAfterAppend = false, exists = true } = {}) {
  const rows = existing.map(r => [r.id]); const calls = []; let failed = false;
  const request = async (path, init = {}) => {
    calls.push({path,init});
    if (path.startsWith('?fields=')) return { sheets: exists ? [{properties:{sheetId:7,title:'Заявки сайта',gridProperties:{rowCount:1000,columnCount:6}}}] : [] };
    if (path === ':batchUpdate') {
      const body=JSON.parse(init.body);
      if(body.requests[0].addSheet){ exists=true; return {replies:[{addSheet:{properties:{sheetId:7,title:'Заявки сайта',gridProperties:{rowCount:1000,columnCount:6}}}}]}; }
      return {};
    }
    if (path.includes(':append')) {
      assert.match(path,/valueInputOption=RAW/); const values=JSON.parse(init.body).values;rows.push(...values);
      if (failAfterAppend && !failed) {failed=true;throw new Error('ambiguous append timeout');}
      return {updates:{updatedRows:values.length}};
    }
    const decoded=decodeURIComponent(path);
    if(decoded.includes('!A1:F1')) return {values:[wrongHeaders ? ['Не наши данные'] : [...registrationSheetHeaders]]};
    if(decoded.includes('!A2:A')) return {values:rows.map(r=>[r[0]])};
    throw new Error(`Unexpected request ${path}`);
  };
  return {request,rows,calls};
}
function exporter(mock) {return new GoogleSheetsRegistrationExporter({tabName:'Заявки сайта'},mock.request);}

test('Google export appends only missing IDs, uses literal values and Moscow timestamps, and retries safely',async()=>{
 const a=record('one');const b=record('two','=HYPERLINK("https://example.invalid")');const mock=mockSheet({existing:[a]});const client=exporter(mock);
 const result=await client.sync([b,a]);assert.equal(result.exported,1);assert.equal(result.total,2);assert.equal(mock.rows.length,2);
 assert.equal(mock.rows[1][2],b.name);assert.equal(mock.rows[1][3],b.phone);assert.equal(mock.rows[1][4],b.company);assert.match(mock.rows[1][1],/13:00/);
 assert.equal((await client.sync([a,b])).exported,0);assert.equal(mock.rows.length,2);
});
test('Google export never overwrites an existing sheet with incompatible headers',async()=>{
 const mock=mockSheet({wrongHeaders:true});await assert.rejects(exporter(mock).sync([record('one')]),/заголов/i);
 assert.equal(mock.calls.some(c=>c.path.includes(':append')||c.path===':batchUpdate'),false);
});
test('Google export recovers an ambiguous committed append without duplicating the row',async()=>{
 const mock=mockSheet({failAfterAppend:true});const client=exporter(mock);await assert.rejects(client.sync([record('one')]));
 assert.equal((await client.sync([record('one')])).exported,0);assert.equal(mock.rows.length,1);
});
test('Google export creates only its dedicated tab and initializes it before append',async()=>{
 const mock=mockSheet({exists:false});await exporter(mock).sync([record('one')]);
 const writes=mock.calls.filter(c=>c.path===':batchUpdate').map(c=>JSON.parse(c.init.body));
 assert.equal(writes[0].requests[0].addSheet.properties.title,'Заявки сайта');
 assert(writes.some(w=>w.requests.some(r=>r.updateCells?.fields==='userEnteredValue')));assert.equal(mock.rows.length,1);
});

test('Google export does not initialize a headerless tab that already contains data in other columns',async()=>{
 let wrote=false;
 const request=async (path)=>{
  if(path.startsWith('?fields='))return {sheets:[{properties:{sheetId:7,title:'Заявки сайта',gridProperties:{rowCount:1000,columnCount:6}}}]};
  const decoded=decodeURIComponent(path);
  if(decoded.includes('!A2:A'))return {values:[]};
  if(decoded.endsWith('!A1:F1'))return {values:[]};
  if(decoded.endsWith('!A1:F1000'))return {values:[[],['','Существующие данные']]};
  wrote=true;throw Error('Unexpected write');
 };
 await assert.rejects(new GoogleSheetsRegistrationExporter({tabName:'Заявки сайта'},request).sync([record('one')]),/уже есть данные/i);assert.equal(wrote,false);
});
