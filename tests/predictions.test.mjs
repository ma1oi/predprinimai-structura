import assert from 'node:assert/strict';import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import test from 'node:test';
import {PredictionStore,validatePredictionDocument} from '../lib/prediction-store.ts';
const item={id:'new',text:' Хороший  разговор\nоткроет возможность. ',published:true};
test('predictions normalize whitespace and reject empty/oversized text, unsafe IDs and invalid publication flags',()=>{
 assert.equal(validatePredictionDocument({revision:'abc',predictions:[item]}).predictions[0].text,'Хороший разговор откроет возможность.');
 for(const patch of [{text:' '},{text:'я'.repeat(101)},{text:'bad\u0000value'},{published:'yes'},{id:'../bad'}])assert.throws(()=>validatePredictionDocument({revision:'abc',predictions:[{...item,...patch}]}));
 assert.throws(()=>validatePredictionDocument({revision:'abc',predictions:[item,item]}));assert.throws(()=>validatePredictionDocument({revision:'',predictions:[]}));
});
test('predictions seed the seven current texts, preserve order/visibility and reject stale concurrent saves',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'predictions-'));try{const store=new PredictionStore(dir);const original=await store.read();assert.equal(original.predictions.length,7);
 const entries=[item,{...original.predictions[0],published:false},original.predictions[1]];
 const results=await Promise.allSettled([store.save({revision:original.revision,predictions:entries}),new PredictionStore(dir).save({...original,predictions:[]})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 const saved=await new PredictionStore(dir).read();assert.deepEqual(saved.predictions.map(p=>p.id),entries.map(p=>p.id));assert.deepEqual((await store.published()).map(p=>p.id),[item.id,original.predictions[1].id]);assert.deepEqual(JSON.parse(await readFile(path.join(dir,'predictions.json'),'utf8')),saved);await store.save({...saved,predictions:[]});assert.deepEqual(await store.published(),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('corrupt prediction storage is preserved instead of overwritten',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'predictions-bad-'));try{const file=path.join(dir,'predictions.json');await writeFile(file,'{bad');await assert.rejects(new PredictionStore(dir).save({revision:'old',predictions:[]}),e=>e.status===500);assert.equal(await readFile(file,'utf8'),'{bad');}finally{await rm(dir,{recursive:true,force:true});}
});
