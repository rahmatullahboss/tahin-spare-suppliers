// Capture a short CPU profile of our deployed Worker via Cloudflare's documented API.
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { setTimeout as sleep } from "node:timers/promises";

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
assert.ok(account && token, "Cloudflare account/token required");
const routes = ["/", "/category/spare-parts"];
let done = false;
const traffic = (async () => {
  for (let i = 0; i < 30 && !done; i++) {
    try {
      const response = await fetch("https://tahinspare.com" + routes[i % routes.length], {headers: {"Cache-Control":"no-cache"}, signal: AbortSignal.timeout(8000)});
      await response.arrayBuffer();
      if (!response.ok) console.log("Probe status", response.status);
    } catch { console.log("Probe failed"); }
    await sleep(500);
  }
})();
let raw;
try {
  await sleep(1800);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/workers/tahin-spare-suppliers/versions/latest-deployed/profile`, {
    method:"POST", headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}, body:JSON.stringify({duration_ms:10000,profile_type:"cpu"}), signal:AbortSignal.timeout(40000)
  });
  if (!response.ok) {
    console.log("Profile API status", response.status);
    const error = await response.json().catch(()=>({}));
    console.log(JSON.stringify((error.errors ?? []).map(e=>({code:e.code,message:e.message}))));
    process.exitCode = 1;
  } else {
    raw = Buffer.from(await response.arrayBuffer());
  }
} finally {
  done = true;
  await traffic;
}
if (!raw) process.exit(1);
const data = raw[0] === 31 && raw[1] === 139 ? gunzipSync(raw) : raw;
// Minimal protobuf reader for the standard pprof Profile fields.
function readVarint(b, offset) {
  let value=0n, shift=0n;
  for (let i=offset;i<b.length;i++) {
    const byte=b[i]; value |= BigInt(byte & 127)<<shift;
    if (!(byte&128)) return [Number(BigInt.asIntN(64,value)),i+1];
    shift+=7n;
    if (shift>70n) throw new Error("Invalid varint");
  }
  throw new Error("Truncated varint");
}
function fields(b) {
  const out=[];
  let p=0;
  while(p<b.length) {
    let tag; [tag,p]=readVarint(b,p);
    const n=tag>>>3, wire=tag&7;
    if(wire===0) {let v;[v,p]=readVarint(b,p);out.push([n,v]);}
    else if(wire===2) {let len;[len,p]=readVarint(b,p);assert.ok(len>=0&&p+len<=b.length);out.push([n,b.subarray(p,p+len)]);p+=len;}
    else if(wire===1) p+=8;
    else if(wire===5) p+=4;
    else throw new Error("Unsupported protobuf field");
  }
  return out;
}
const get=(f,n)=>f.find(x=>x[0]===n)?.[1];
function values(f,n) {
  return f.filter(x=>x[0]===n).flatMap(([,v])=>{
    if(typeof v==="number")return [v];
    let p=0;const a=[];while(p<v.length){let k;[k,p]=readVarint(v,p);a.push(k);}return a;
  });
}
const profile=fields(data);
const strings=profile.filter(x=>x[0]===6).map(x=>x[1].toString());
const types=profile.filter(x=>x[0]===1).map(x=>{const f=fields(x[1]);return {type:strings[get(f,1)],unit:strings[get(f,2)]};});
const functions=new Map(profile.filter(x=>x[0]===5).map(x=>{const f=fields(x[1]);return [get(f,1),{name:strings[get(f,2)],file:strings[get(f,4)]}];}));
const locations=new Map(profile.filter(x=>x[0]===4).map(x=>{const f=fields(x[1]);const line=f.find(y=>y[0]===4);const detail=line?fields(line[1]):[];return [get(f,1),{...functions.get(get(detail,1)),line:get(detail,2)}];}));
const index=Math.max(0,types.findIndex(t=>t.type==="cpu"));
const totals=new Map();let total=0;
const samples=profile.filter(x=>x[0]===2);
for(const [,sample] of samples){
  const f=fields(sample), weight=values(f,2)[index]??0;
  const location=locations.get(values(f,1)[0]);
  const key=JSON.stringify(location??{name:"unknown"});
  totals.set(key,(totals.get(key)??0)+weight);total+=weight;
}
console.log(JSON.stringify({types,samples:samples.length,total,topSelf:[...totals].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([key,weight])=>({...JSON.parse(key),weight,percent:total?Math.round(1000*weight/total)/10:0}))},null,2));
