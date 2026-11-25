// Isolated local-only Worker/R2 test. No production bindings or email provider.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

const temp = await mkdtemp(join(tmpdir(),"tahin-attachment-qa-"));
const socket = createServer();
await new Promise((done,reject)=>{socket.once("error",reject);socket.listen(0,"127.0.0.1",done)});
const port=socket.address().port;
await new Promise(done=>socket.close(done));
let worker;
let log="";
try {
  await build({stdin:{contents:`import { decodeBase64, storeSentEmailAttachments } from "./src/lib/server/sent-email-attachments.ts";
import { servePublicImage } from "./src/lib/server/public-image.ts";
export default {async fetch(request,env){
 const mode=new URL(request.url).pathname;
 if(mode==="/ready") return new Response("ok");
 if(mode==="/seed-image"){
  await env.TEST_BUCKET.put("images/qa-public.png",new Uint8Array([1,2,3,4]),{httpMetadata:{contentType:"image/png"}});
  return new Response("ok");
 }
 if(mode==="/remove-image"){
  await env.TEST_BUCKET.delete("images/qa-public.png");
  return new Response("ok");
 }
 if(mode.startsWith("/images/") || mode.startsWith("/email/")){
  return (await servePublicImage(request,{MEDIA_BUCKET:env.TEST_BUCKET},caches.default)) ?? new Response("missing",{status:404});
 }
 const data=await request.text();
 const headers={"x-native":typeof Uint8Array.fromBase64};
 if(mode==="/store"){
  const manifest=await storeSentEmailAttachments(env.TEST_BUCKET,"synthetic-email",[],[{id:"synthetic-file",filename:"fixture.bin",contentType:"application/octet-stream",contentBase64:data}]);
  const object=await env.TEST_BUCKET.get(manifest[0].storageKey);
  return new Response(object.body,{headers});
 }
 try{
  let decoded;
  if(mode==="/old"){const s=atob(data.replace(/\\s/g,""));decoded=new Uint8Array(s.length);for(let i=0;i<s.length;i++)decoded[i]=s.charCodeAt(i)}
  else decoded=decodeBase64(data);
  return new Response(decoded,{headers});
 }catch{return new Response("invalid",{status:400,headers});}
}}`,resolveDir:process.cwd(),loader:"ts"},bundle:true,format:"esm",platform:"neutral",outfile:join(temp,"worker.mjs")});
  await writeFile(join(temp,"wrangler.json"),JSON.stringify({name:"tahin-attachment-local-qa",main:"worker.mjs",compatibility_date:"2026-03-29",compatibility_flags:["nodejs_compat"],r2_buckets:[{binding:"TEST_BUCKET",bucket_name:"synthetic-local-fixture"}]}));
  worker=spawn(resolve("node_modules/.bin/wrangler"),["dev","--local","--config",join(temp,"wrangler.json"),"--ip","127.0.0.1","--host","127.0.0.1","--port",String(port),"--persist-to",join(temp,"state"),"--show-interactive-dev-session=false"],{cwd:temp,stdio:["ignore","pipe","pipe"]});
  for(const stream of [worker.stdout,worker.stderr])stream.on("data",chunk=>{log=(log+chunk).slice(-6000)});
  const base="http://127.0.0.1:"+port;
  let ready=false;
  for(let i=0;i<40;i++){if(worker.exitCode!==null)break;try{const r=await fetch(base+"/ready",{signal:AbortSignal.timeout(1000)});if(r.ok){await r.text();ready=true;break}}catch{}await sleep(500)}
  assert.ok(ready,"Local fixture Worker startup failed");
  const data=Buffer.alloc(8*1024*1024,173);
  const encoded=data.toString("base64");
  const timings={old:[],new:[]};
  for(const mode of ["old","new","old","new","old","new"]){
    const start=performance.now();
    const r=await fetch(base+"/"+mode,{method:"POST",body:encoded});
    assert.equal(r.status,200);
    assert.equal(r.headers.get("x-native"),"function","Runtime does not support native Base64");
    assert.deepEqual(Buffer.from(await r.arrayBuffer()),data);
    timings[mode].push(Math.round(performance.now()-start));
  }
  for(const invalid of ["?","a","a===","aa=a","aa==a"]){
    for(const mode of ["old","new"]){
      const r=await fetch(base+"/"+mode,{method:"POST",body:invalid});
      assert.equal(r.status,400);
      await r.text();
    }
  }
  const stored=await fetch(base+"/store",{method:"POST",body:encoded});
  assert.equal(stored.status,200);
  assert.deepEqual(Buffer.from(await stored.arrayBuffer()),data);
  assert.equal((await fetch(base+"/seed-image")).status,200);
  const image=await fetch(base+"/images/qa-public.png");
  assert.equal(image.status,200);
  assert.equal(image.headers.get("content-type"),"image/png");
  assert.equal(image.headers.get("x-frame-options"),"DENY");
  assert.equal(image.headers.get("cache-control"),"public, max-age=31536000, immutable");
  assert.ok(image.headers.get("etag"));
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from([1,2,3,4]));
  assert.equal((await fetch(base+"/remove-image")).status,200);
  const hit=await fetch(base+"/images/qa-public.png");
  assert.equal(hit.status,200);
  assert.equal(hit.headers.get("cache-control"),"public, max-age=604800");
  assert.deepEqual(Buffer.from(await hit.arrayBuffer()),Buffer.from([1,2,3,4]));
  const bypass=await fetch(base+"/images/qa-public.png?qa=1");
  assert.equal(bypass.status,404);
  const privatePath=await fetch(base+"/email/sent/synthetic-email/synthetic-file");
  assert.equal(privatePath.status,404);
  console.log("PASS public R2 media/cache byte integrity, cache query bypass and private path exclusion");
  console.log(JSON.stringify({nativeWorker:true,localEndToEndMs:timings,storageByteParity:"PASS",invalidInputParity:"PASS"}));
} catch(error){console.error(log);throw error}
finally{
  if(worker&&worker.exitCode===null){worker.kill("SIGTERM");await Promise.race([new Promise(done=>worker.once("exit",done)),sleep(2000)])}
  await rm(temp,{recursive:true,force:true});
}
