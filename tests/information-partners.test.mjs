import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import test from 'node:test';
import {InformationPartnerStore,validateInformationPartnerDocument} from '../lib/information-partner-store.ts';
const photo='/media/speakers/7bfe36fa-a37b-4bf8-9089-2d306a8a0b60.webp';
const partner={id:'blogger',name:' Анна Смирнова ',job:' Блогер ',photo,socialUrl:'https://t.me/example',published:true};

test('information partners validate social URLs and uploaded photos before publication',()=>{
 const validated=validateInformationPartnerDocument({revision:'abc',partners:[partner]}).partners[0];
 assert.equal(validated.name,'Анна Смирнова');assert.equal(validated.job,'Блогер');
 for(const patch of [{socialUrl:'javascript:alert(1)'},{socialUrl:'data:text/html,test'},{socialUrl:'https://user:password@example.com/'},{socialUrl:'//example.com'},{socialUrl:'https://exa\nmple.com'},{socialUrl:''},{photo:''},{photo:'https://example.com/image.png'},{photo:'/media/speakers/../../secret.webp'},{published:1},{name:' '},{job:'x'.repeat(301)},{id:'../bad'}]) assert.throws(()=>validateInformationPartnerDocument({revision:'abc',partners:[{...partner,...patch}]}));
 assert.throws(()=>validateInformationPartnerDocument({revision:'abc',partners:[partner,partner]}));
 assert.throws(()=>validateInformationPartnerDocument({revision:'',partners:[]}));
 assert.doesNotThrow(()=>validateInformationPartnerDocument({revision:'abc',partners:[{...partner,published:false,photo:'',socialUrl:''}]}));
 assert.doesNotThrow(()=>validateInformationPartnerDocument({revision:'abc',partners:[{...partner,job:''}]}));
});

test('information partners start empty, retain order and publication, reject stale concurrent edits',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'information-partners-'));try{
  const store=new InformationPartnerStore(dir),original=await store.read();assert.deepEqual(original.partners,[]);
  const next=[partner,{...partner,id:'hidden',name:'Скрытый',published:false}];
  const results=await Promise.allSettled([store.save({revision:original.revision,partners:next}),new InformationPartnerStore(dir).save({revision:original.revision,partners:[]})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  const saved=await new InformationPartnerStore(dir).read();assert.deepEqual(saved.partners.map(p=>p.id),['blogger','hidden']);assert.deepEqual((await store.published()).map(p=>p.id),['blogger']);
  assert.deepEqual(JSON.parse(await readFile(path.join(dir,'information-partners.json'),'utf8')),saved);
  await store.save({...saved,partners:[]});assert.deepEqual(await store.published(),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('damaged information partners cannot be overwritten with an empty list',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'information-partners-bad-'));try{
  const file=path.join(dir,'information-partners.json');await writeFile(file,'{broken');
  await assert.rejects(new InformationPartnerStore(dir).save({revision:'old',partners:[]}),e=>e.status===500);
  assert.equal(await readFile(file,'utf8'),'{broken');
 }finally{await rm(dir,{recursive:true,force:true});}
});
