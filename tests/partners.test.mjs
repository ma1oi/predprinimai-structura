import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import test from 'node:test';
import {PartnerStore,validatePartnerDocument} from '../lib/partner-store.ts';
const logo='/media/speakers/7bfe36fa-a37b-4bf8-9089-2d306a8a0b60.webp';
const partner={id:'new-partner',name:' Новый партнёр ',logo,published:true};

test('partner validation accepts uploaded/builtin logos, preserves order and rejects unsafe paths and duplicate IDs',()=>{
 assert.equal(validatePartnerDocument({revision:'abc',partners:[partner]}).partners[0].name,'Новый партнёр');
 for(const patch of [{logo:'https://example.com/logo.svg'},{logo:'/media/speakers/../../secret.webp'},{logo:'/assets/figma/other.webp'},{logo:''},{name:' '},{published:'true'},{id:'../bad'}])assert.throws(()=>validatePartnerDocument({revision:'abc',partners:[{...partner,...patch}]}));
 assert.throws(()=>validatePartnerDocument({revision:'abc',partners:[partner,partner]}));
 assert.throws(()=>validatePartnerDocument({revision:'',partners:[]}));
 assert.equal(validatePartnerDocument({revision:'abc',partners:[{...partner,logo:'',published:false}]}).partners[0].logo,'');
});
test('partner store seeds existing logos, saves ordered visibility and rejects stale concurrent updates',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'partners-'));try{
  const store=new PartnerStore(dir);const original=await store.read();assert.equal(original.partners.length,2);assert(original.partners.every(p=>p.published&&p.logo.startsWith('/assets/figma/')));
  const next=[partner,{...original.partners[1],published:false},original.partners[0]];
  const results=await Promise.allSettled([store.save({revision:original.revision,partners:next}),new PartnerStore(dir).save({revision:original.revision,partners:[]})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  const doc=await new PartnerStore(dir).read();assert.deepEqual(doc.partners.map(p=>p.id),next.map(p=>p.id));assert.deepEqual((await store.published()).map(p=>p.id),[partner.id,original.partners[0].id]);assert.deepEqual(JSON.parse(await readFile(path.join(dir,'partners.json'),'utf8')),doc);
  await store.save({...doc,partners:[]});assert.deepEqual(await store.published(),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('a damaged partners file is never replaced by a save',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'partners-corrupt-'));try{const file=path.join(dir,'partners.json');await writeFile(file,'{broken');const store=new PartnerStore(dir);await assert.rejects(store.save({revision:'old',partners:[]}),e=>e.status===500);assert.equal(await readFile(file,'utf8'),'{broken');}finally{await rm(dir,{recursive:true,force:true});}
});
