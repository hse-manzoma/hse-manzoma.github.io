/* Supabase adapter: provides the same window.claude.use(...) surface the app was written against. */
(function(){
const SB_URL="https://dahpolyciepvshcdvzhp.supabase.co";
const SB_KEY="sb_publishable_M7kMm2AINzWl8YDB-pTzDg_dMezgEir";
const DOMAIN="hse-swary.app";
const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"hse-swary-auth"}});
window.SB=sb;window.SB_URL=SB_URL;window.SB_KEY=SB_KEY;
const emailOf=u=>`${String(u).trim().toLowerCase().replace(/[^a-z0-9._-]/g,"")}@${DOMAIN}`;
window.SBA={emailOf,DOMAIN,profile:null,user:null};
async function cleanupLocalPush(){
  try{const reg=await navigator.serviceWorker?.getRegistration();if(!reg)return;const [sub,notifs]=await Promise.all([reg.pushManager?.getSubscription(),reg.getNotifications?.()||[]]);for(const n of notifs||[])try{n.close()}catch(e){}if(sub){try{await sb.from("push_subs").delete().eq("endpoint",sub.endpoint)}catch(e){console.warn("Could not remove push subscription row",e)}try{await sub.unsubscribe()}catch(e){}}}catch(e){console.warn("Push cleanup skipped",e)}
}
async function cleanupOtherPushRows(){try{const reg=await navigator.serviceWorker?.getRegistration(),sub=await reg?.pushManager?.getSubscription();let q=sb.from("push_subs").delete();if(sub)q=q.neq("endpoint",sub.endpoint);const {error}=await q;if(error){console.warn("Could not remove push subscriptions from other browsers",error);window.SBA.pushCleanupWarning=true;return false}window.SBA.pushCleanupWarning=false;return true}catch(e){console.warn("Other-browser push cleanup skipped",e);window.SBA.pushCleanupWarning=true;return false}}
window.SBA.cleanupLocalPush=cleanupLocalPush;
window.SBA.logout=async()=>{await cleanupLocalPush();const {error}=await sb.auth.signOut({scope:"local"});if(error)throw error};

/* ---------- auth gate ---------- */
let readyResolve;const ready=new Promise(r=>readyResolve=r);
async function fn(action,payload){
  let {data:{session}}=await sb.auth.getSession();
  const call=tok=>fetch(`${SB_URL}/functions/v1/admin-users`,{method:"POST",headers:{"Content-Type":"application/json",apikey:SB_KEY,Authorization:"Bearer "+(tok||SB_KEY)},body:JSON.stringify({action,...payload})});
  let r=await call(session?.access_token);
  let j={};try{j=await r.json()}catch(e){}
  if((r.status===401||r.status===403||j.error==="unauthorized")&&session){try{const rf=await sb.auth.refreshSession();if(rf&&rf.data&&rf.data.session)session=rf.data.session}catch(e){}r=await call(session?.access_token);j={};try{j=await r.json()}catch(e){}}
  if(!r.ok||j.error)throw Object.assign(new Error(j.error||("http_"+r.status)),{code:j.error||"http_"+r.status});
  return j;
}
window.SBA.fn=fn;
const AR={unauthorized:"السيرفر رفض الصلاحية. اتأكد إنك داخل بحساب مدير المنظومة، وجرّب تعمل خروج ودخول تاني. لو فضلت، لازم حسابك يتفعّل كمدير على السيرفر.",http_401:"انتهت الجلسة — اعمل دخول تاني.",http_403:"الصلاحية مرفوضة من السيرفر.",bad_username:"اسم المستخدم لازم يكون حروف إنجليزي أو أرقام (٣ حروف على الأقل)",weak_password:"كلمة السر لازم ٦ حروف أو أرقام على الأقل",admin_exists:"حساب المدير اتعمل قبل كده، سجّل دخول",username_taken:"اسم المستخدم ده مستخدم قبل كده","Invalid login credentials":"اسم المستخدم أو كلمة السر غلط"};
window.SBA.ar=e=>AR[e?.code]||AR[e?.message]||e?.message||"حصلت مشكلة، جرّب تاني";

function gateHTML(first){return `<div id="gate" style="position:fixed;inset:0;z-index:9999;background:var(--bg,#f4f6f5);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:'IBM Plex Sans Arabic',system-ui,sans-serif">
  <form id="gateForm" style="width:100%;max-width:380px;background:var(--surface,#fff);border:1px solid var(--line,#dde3e0);border-radius:16px;padding:26px;box-shadow:0 10px 30px rgba(0,0,0,.06)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><span style="width:38px;height:38px;border-radius:10px;background:#d9480f;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700">✓</span><div><div style="font-weight:700;font-size:18px">منظومة السلامة</div><div style="font-size:12.5px;color:#6b7a73">HSE · Swary West40</div></div></div>
    <h2 style="font-size:17px;margin:18px 0 4px">${first?"إنشاء حساب المدير":"تسجيل الدخول"}</h2>
    <p style="margin:0 0 14px;font-size:13px;color:#6b7a73">${first?"أول مرة: اختار اسم مستخدم وكلمة سر لحسابك كمدير للمنظومة. احفظهم كويس.":"اكتب اسم المستخدم وكلمة السر اللي وصلوك."}</p>
    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">اسم المستخدم</label>
    <input name="u" dir="ltr" autocomplete="username" required style="width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cfd8d3;border-radius:10px;font-size:15px;margin-bottom:12px" placeholder="${first?"مثلاً: admin أو 5160":""}">
    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">كلمة السر</label>
    <input name="p" type="password" dir="ltr" autocomplete="${first?"new-password":"current-password"}" required style="width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cfd8d3;border-radius:10px;font-size:15px;margin-bottom:12px">
    ${first?`<label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">تأكيد كلمة السر</label><input name="p2" type="password" dir="ltr" autocomplete="new-password" required style="width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cfd8d3;border-radius:10px;font-size:15px;margin-bottom:12px">`:""}
    <div id="gateMsg" style="color:#c92a2a;font-size:13px;min-height:18px;margin-bottom:8px">${(()=>{try{const m=sessionStorage.getItem("hse.session.enforce.error")||"";sessionStorage.removeItem("hse.session.enforce.error");return m}catch(e){return ""}})()}</div>
    <button style="width:100%;padding:12px;border:0;border-radius:10px;background:#d9480f;color:#fff;font-size:15px;font-weight:700;cursor:pointer">${first?"إنشاء الحساب والدخول":"دخول"}</button>
  </form></div>`}
async function showGate(message=""){
  let first=false;try{const {data}=await sb.rpc("has_admin");first=data===false}catch(e){}
  document.getElementById("gate")?.remove();document.body.insertAdjacentHTML("beforeend",gateHTML(first));
  const f=document.getElementById("gateForm"),msg=document.getElementById("gateMsg");
  if(message)msg.textContent=message;
  f.onsubmit=async e=>{e.preventDefault();msg.textContent="";const u=f.u.value.trim().toLowerCase(),p=f.p.value;
    try{if(first){if(p!==f.p2.value){msg.textContent="كلمتين السر مش زي بعض";return}await fn("bootstrap",{username:u,password:p})}
      const {error}=await sb.auth.signInWithPassword({email:emailOf(u),password:p});if(error)throw error;
    }catch(err){msg.textContent=window.SBA.ar(err)}};
}
async function loadProfile(uid){const {data}=await sb.from("profiles").select("*").eq("user_id",uid).maybeSingle();return data}
async function afterLogin(session){
  window.SBA.user=session.user;const prof=await loadProfile(session.user.id);window.SBA.profile=prof;
  if(!prof||prof.disabled){document.getElementById("gate")?.remove();document.body.insertAdjacentHTML("beforeend",`<div id="gate" style="position:fixed;inset:0;z-index:9999;background:#f4f6f5;display:flex;align-items:center;justify-content:center;direction:rtl;font-family:system-ui;padding:16px"><div style="background:#fff;border-radius:16px;padding:26px;max-width:380px;text-align:center"><h2 style="font-size:17px">${prof?"حسابك موقوف":"الحساب ده مالوش صلاحيات"}</h2><p style="color:#6b7a73;font-size:14px">كلّم مدير المنظومة.</p><button onclick="SBA.logout().then(()=>location.reload())" style="padding:10px 18px;border:0;border-radius:10px;background:#d9480f;color:#fff">خروج</button></div></div>`);return}
  // Logging in keeps existing browser sessions intact.
  await cleanupOtherPushRows();
  document.getElementById("gate")?.remove();readyResolve();
}
let started=false,activeUid="",loginFlow=Promise.resolve();
function acceptSession(session){
  if(!session){showGate();return}
  if(started&&activeUid===session.user?.id)return;
  started=true;activeUid=session.user?.id||"";
  // Supabase auth callbacks run under its auth lock. Defer all follow-up Supabase calls.
  loginFlow=loginFlow.catch(()=>{}).then(()=>new Promise(resolve=>setTimeout(resolve,0)))
    .then(()=>afterLogin(session))
    .catch(async e=>{console.error("Session initialization failed",e);started=false;activeUid="";try{await sb.auth.signOut({scope:"local"})}catch(_){}await showGate("تعذر تحميل صلاحيات الحساب. تحقق من الاتصال ثم سجّل الدخول مرة أخرى.")});
}
sb.auth.onAuthStateChange((ev,session)=>{
  if(session)acceptSession(session);
  else if(ev==="SIGNED_OUT")cleanupLocalPush().finally(()=>location.reload());
});
sb.auth.getSession().then(({data:{session},error})=>{if(error)throw error;if(session)acceptSession(session);else showGate()})
  .catch(e=>{console.error("Could not restore auth session",e);showGate("تعذر استعادة الجلسة. سجّل الدخول مرة أخرى.")});

/* ---------- document store ---------- */
const PAGE=1000;
async function fetchCol(col){let out=[],from=0;for(;;){const {data,error}=await sb.from("docs").select("id,data").eq("col",col).range(from,from+PAGE-1);if(error)throw error;out=out.concat(data);if(data.length<PAGE)break;from+=PAGE}return out}
async function fetchProfiles(){const {data,error}=await sb.from("profiles").select("*");if(error)throw error;return data.map(p=>({id:p.user_id,data:p}))}
const snap=rows=>({docs:rows.map(r=>({id:r.id,exists:true,data:()=>r.data})),size:rows.length});
const subs={};let chan=null;
function ensureChannel(){
  if(chan)return;chan=sb.channel("docs-all")
   .on("postgres_changes",{event:"*",schema:"public",table:"docs"},p=>{const row=p.new&&p.new.col?p.new:p.old;const c=row?.col;const S=subs[c];if(!S)return;
     if(p.eventType==="DELETE")S.map.delete(p.old.id);else S.map.set(p.new.id,p.new.data);S.emit()})
   .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},p=>{const S=subs.__profiles;if(!S)return;if(p.eventType==="DELETE")S.map.delete(p.old.user_id);else S.map.set(p.new.user_id,p.new);S.emit()})
   .subscribe();
}
function subscribe(col,cb,err){
  let S=subs[col];
  if(!S){S=subs[col]={map:new Map(),cbs:new Set(),t:0,loaded:false,emit(){clearTimeout(S.t);S.t=setTimeout(()=>{const rows=[...S.map].map(([id,data])=>({id,data}));for(const f of S.cbs)try{f(snap(rows))}catch(e){console.error(e)}},60)}};
    ensureChannel();
    (col==="__profiles"?fetchProfiles():fetchCol(col)).then(rows=>{for(const r of rows)S.map.set(r.id,r.data);S.loaded=true;S.emit()}).catch(e=>{console.error(e);err&&err(e)})}
  S.cbs.add(cb);if(S.loaded)S.emit();
  return ()=>S.cbs.delete(cb);
}
const rid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)).replace(/-/g,"").slice(0,20);
function local(col,id,data){const S=subs[col];if(!S)return;if(data===null)S.map.delete(id);else S.map.set(id,data);S.emit()}
async function getDoc(col,id){
  if(col==="private"){const {data}=await sb.from("private_docs").select("data").eq("id",id).maybeSingle();return data?data.data:null}
  const {data,error}=await sb.from("docs").select("data").eq("col",col).eq("id",id).maybeSingle();if(error)throw error;return data?data.data:null}
async function setDoc(col,id,data){
  if(col==="private"){const {error}=await sb.from("private_docs").upsert({id,data});if(error)throw norm(error);return}
  const {error}=await sb.from("docs").upsert({col,id,data,updated_at:new Date().toISOString()});if(error)throw norm(error);local(col,id,data)}
async function delDoc(col,id){
  if(col==="private"){await sb.from("private_docs").delete().eq("id",id);return}
  const {error}=await sb.from("docs").delete().eq("col",col).eq("id",id);if(error)throw norm(error);local(col,id,null)}
function norm(e){const x=new Error(e.message||String(e));x.code=/row-level security|permission/i.test(e.message||"")?"permission_denied":(e.code||"error");return x}
function docRef(col,id){return {
  id,
  get:async()=>{const d=await getDoc(col,id);return {exists:!!d,id,data:()=>d}},
  set:d=>setDoc(col,id,d),
  update:async d=>{const cur=(await getDoc(col,id))||{};return setDoc(col,id,{...cur,...d})},
  delete:()=>delDoc(col,id),
  onSnapshot:(cb,err)=>subscribe(col,s=>{const d=s.docs.find(x=>x.id===id);cb({exists:!!d,id,data:()=>d?d.data():undefined})},err)
}}
const db={
  collection:p=>({
    onSnapshot:(cb,err)=>p==="members"?(setTimeout(()=>cb(snap([])),0),()=>{}):subscribe(p,cb,err),
    doc:id=>docRef(p,id),
    add:async d=>{const id=rid();await setDoc(p,id,d);return {id}}
  }),
  doc:path=>{const [c,...rest]=path.split("/");return docRef(c,rest.join("/"))}
};

/* ---------- files (assets) ---------- */
const urlCache=new Map();
async function signed(id){if(urlCache.has(id))return urlCache.get(id);const p=(async()=>{const {data,error}=await sb.storage.from("files").createSignedUrl(id,60*60*12);if(error)throw error;return data.signedUrl})();urlCache.set(id,p);try{return await p}catch(e){urlCache.delete(id);throw e}}
window.SBA.signed=signed;
const assets={
  upload:async(blob,opt={})=>{const type=opt.type||blob.type||"application/octet-stream";const id=rid()+({"image/jpeg":".jpg","image/png":".png","image/webp":".webp","application/pdf":".pdf"}[type]||"");
    const {error}=await sb.storage.from("files").upload(id,blob,{contentType:type,upsert:false});if(error)throw Object.assign(new Error(error.message),{code:/size/i.test(error.message)?"too_large":"upstream_error"});
    return {id,url:"_blob/"+id,sizeBytes:blob.size,contentType:type}},
  list:async()=>({assets:[],usage:{}}),
  delete:async id=>{await sb.storage.from("files").remove([id]);return {deleted:true}}
};
/* resolve _blob/ references in img/a/fetch to signed URLs */
const BLOB_RE=/(?:^|\/)_blob\/([A-Za-z0-9._-]+)/;
function fixEl(el){
  for(const attr of ["src","href","data-view"]){const v=el.getAttribute&&el.getAttribute(attr);const m=v&&v.match(BLOB_RE);
    if(m&&!(attr==="data-view")){el.setAttribute(attr,el.tagName==="IMG"?"data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==":"#");el.dataset.blob=m[1];signed(m[1]).then(u=>el.setAttribute(attr,u)).catch(()=>{if(el.tagName==="IMG")el.dispatchEvent(new Event("error"))})}
    else if(m&&attr==="data-view"){signed(m[1]).then(u=>el.setAttribute("data-view",u)).catch(()=>{})}}
}
new MutationObserver(ms=>{for(const m of ms){if(m.type==="attributes")fixEl(m.target);else for(const n of m.addedNodes){if(n.nodeType!==1)continue;fixEl(n);n.querySelectorAll&&n.querySelectorAll("img,a,[data-view]").forEach(fixEl)}}})
  .observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["src","href","data-view"]});
const ofetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{const u=typeof input==="string"?input:input?.url;const m=u&&u.match(BLOB_RE);if(m&&!/^https?:/.test(u))return ofetch(await signed(m[1]),init);return ofetch(input,init)};

/* ---------- downloads ---------- */
const downloads={save:async({filename,data})=>{const u=URL.createObjectURL(data);const a=document.createElement("a");a.href=u;a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},4000);return {status:"saved"}}};

/* ---------- user ---------- */
const user={
  isOwner:async()=>window.SBA.profile?.role==="admin",
  canEdit:async()=>window.SBA.profile?.role==="admin",
  can:async()=>true,
  id:async()=>window.SBA.user?.id||null,
  name:async()=>window.SBA.profile?.username||"",
  me:async()=>({id:window.SBA.user?.id,name:window.SBA.profile?.username||""}),
  profiles:async ids=>Object.fromEntries((ids||[]).map(i=>[i,{id:i,name:""}])),
  search:async()=>[]
};
window.claude={use:async name=>{await ready;return {db,user,assets,downloads}[name]||null}};
window.SBA.ready=ready;
})();
