/* Supabase adapter: provides the same window.claude.use(...) surface the app was written against. */
(function(){
const SB_URL="https://dahpolyciepvshcdvzhp.supabase.co";
const SB_KEY="sb_publishable_M7kMm2AINzWl8YDB-pTzDg_dMezgEir";
const DOMAIN="hse-swary.app";
const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"hse-swary-auth"}});
window.SB=sb;window.SB_URL=SB_URL;window.SB_KEY=SB_KEY;
const emailOf=u=>`${String(u).trim().toLowerCase().replace(/[^a-z0-9._-]/g,"")}@${DOMAIN}`;
window.SBA={emailOf,DOMAIN,profile:null,user:null};

/* ================= طبقة الشغل بدون نت (مرآة محلية + طابور مزامنة) =================
   الفكرة: كل قراءة بتتخزن نسخة منها على الجهاز، وكل كتابة بتتسجل محلياً الأول
   وبعدين تتبعت للسيرفر. لو مفيش نت بتتحط في طابور وتتبعت لوحدها أول ما النت يرجع. */
const NET=()=>navigator.onLine!==false;
const isNet=e=>{const m=String(e&&(e.message||e)||"");return !NET()||/fetch|network|offline|timeout|Load failed|ERR_INTERNET|ERR_NETWORK|NetworkError/i.test(m)};
let IDB=null;
function idb(){
  if(IDB)return IDB;
  IDB=new Promise((res,rej)=>{
    let r;try{r=indexedDB.open("hse-offline",1)}catch(e){rej(e);return}
    r.onupgradeneeded=()=>{const d=r.result;
      if(!d.objectStoreNames.contains("docs"))d.createObjectStore("docs",{keyPath:"k"});
      if(!d.objectStoreNames.contains("outbox"))d.createObjectStore("outbox",{keyPath:"seq",autoIncrement:true});
      if(!d.objectStoreNames.contains("blobs"))d.createObjectStore("blobs",{keyPath:"id"});
      if(!d.objectStoreNames.contains("meta"))d.createObjectStore("meta",{keyPath:"k"})};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error("idb_blocked"));
  }).catch(e=>{console.warn("التخزين المحلي مش متاح",e);return null});
  return IDB;
}
async function ido(name,mode,fn){
  const d=await idb();if(!d)return null;
  try{return await new Promise((res,rej)=>{
    const t=d.transaction(name,mode);const r=fn(t.objectStore(name));
    if(r&&typeof r.onsuccess!=="undefined"){r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}
    else{t.oncomplete=()=>res(true)}
    t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error("aborted"))})}
  catch(e){console.warn("خطأ تخزين محلي",name,e);return null}
}
const K=(col,id)=>col+"\u0000"+id;
const cacheGet=(col,id)=>ido("docs","readonly",s=>s.get(K(col,id))).then(r=>r?r.data:null);
const cachePut=(col,id,data)=>ido("docs","readwrite",s=>s.put({k:K(col,id),col,id,data,at:Date.now()}));
const cacheDel=(col,id)=>ido("docs","readwrite",s=>s.delete(K(col,id)));
const cacheCol=col=>ido("docs","readonly",s=>s.getAll(IDBKeyRange.bound(col+"\u0000",col+"\u0000￿")))
  .then(r=>(r||[]).map(x=>({id:x.id,data:x.data})));
/* نسخة القائمة كلها بتتكتب في معاملة واحدة.
   (كانت معاملة لكل صف — مع آلاف الصفوف كانت بتخنق الصفحة وتخليها ما تحمّلش) */
async function cacheReplaceCol(col,rows){
  const d=await idb();if(!d)return;
  const keep=new Set(rows.map(r=>r.id));
  try{
    await new Promise((res,rej)=>{
      const t=d.transaction("docs","readwrite"),st=t.objectStore("docs");
      const cur=st.openCursor(IDBKeyRange.bound(col+"\u0000",col+"\u0000\uffff"));
      cur.onsuccess=e=>{
        const c=e.target.result;
        if(c){if(!keep.has(c.value&&c.value.id))c.delete();c.continue();return}
        const at=Date.now();
        for(const r of rows)st.put({k:K(col,r.id),col,id:r.id,data:r.data,at});
      };
      cur.onerror=()=>rej(cur.error);
      t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error("aborted"));
    });
  }catch(e){console.warn("حفظ النسخة المحلية لـ"+col+" فشل",e)}
}
const outAdd=o=>ido("outbox","readwrite",s=>s.add(o));
const outAll=()=>ido("outbox","readonly",s=>s.getAll()).then(r=>(r||[]).sort((a,b)=>a.seq-b.seq));
const outDel=seq=>ido("outbox","readwrite",s=>s.delete(seq));
const outCount=()=>ido("outbox","readonly",s=>s.count()).then(n=>n||0);
const blobPut=(id,blob,type)=>ido("blobs","readwrite",s=>s.put({id,blob,type,at:Date.now()}));
const blobGet=id=>ido("blobs","readonly",s=>s.get(id));
const blobDel=id=>ido("blobs","readwrite",s=>s.delete(id));
const metaGet=k=>ido("meta","readonly",s=>s.get(k)).then(r=>r?r.v:null);
const metaSet=(k,v)=>ido("meta","readwrite",s=>s.put({k,v}));

async function cleanupLocalPush(){
  try{const reg=await navigator.serviceWorker?.getRegistration();if(!reg)return;const [sub,notifs]=await Promise.all([reg.pushManager?.getSubscription(),reg.getNotifications?.()||[]]);for(const n of notifs||[])try{n.close()}catch(e){}if(sub){try{await sb.from("push_subs").delete().eq("endpoint",sub.endpoint)}catch(e){console.warn("Could not remove push subscription row",e)}try{await sub.unsubscribe()}catch(e){}}}catch(e){console.warn("Push cleanup skipped",e)}
}
async function cleanupOtherPushRows(){
  // push_subs has no user_id column, so deleting every other endpoint could remove other users' alerts.
  window.SBA.pushCleanupWarning=false;
  return true;
}
window.SBA.cleanupLocalPush=cleanupLocalPush;
window.SBA.logout=async()=>{authLog("خروج بطلب المستخدم");window.SBA.__bye=true;await cleanupLocalPush();const {error}=await sb.auth.signOut({scope:"local"});if(error)throw error};
/* ---------- سجل الجلسة: بيفضل محفوظ بعد الريفرش عشان نعرف ليه خرج ---------- */
const ALOG="hse.auth.log";
function authLog(msg,extra){
  try{
    const L=JSON.parse(localStorage.getItem(ALOG)||"[]");
    L.push({t:new Date().toISOString(),m:String(msg),...(extra||{})});
    localStorage.setItem(ALOG,JSON.stringify(L.slice(-25)));
  }catch(e){}
  console.warn("[جلسة]",msg,extra||"");
}
window.SBA.authLog=()=>{try{return JSON.parse(localStorage.getItem(ALOG)||"[]")}catch(e){return []}};
window.SBA.authLogClear=()=>{try{localStorage.removeItem(ALOG)}catch(e){}};
/* ---------- حماية من سباق تجديد التوكن ----------
   لو حاجتين جدّدوا نفس الـ refresh token في نفس اللحظة، Supabase بيلغي الجلسة
   وبيرجّع "Auth session missing!" — وده اللي كان بيطلّع المستخدم فجأة.
   فبنخلي التجديد واحد بس في أي لحظة، وبنحتفظ بنسخة من آخر جلسة سليمة للإنقاذ. */
const GKEY="hse.auth.lastgood";
let refreshing=null;
function refreshOnce(who){
  if(refreshing)  {authLog("تجديد تاني اتمنع (شغال واحد بالفعل)",{who});return refreshing}
  if(isLeader!==true&&leaderBeat()!==true){                  /* تاب تابع: مايجدّدش، يستنى القائد */
    authLog("مش دورنا نجدّد — تاب تاني مسؤول",{who});
    return Promise.resolve({data:{session:null},error:null});
  }
  authLog("بنجدّد التوكن",{who});
  refreshing=sb.auth.refreshSession().finally(()=>{setTimeout(()=>{refreshing=null},1200)});
  return refreshing;
}
function keepGood(session){
  try{if(session&&session.refresh_token)localStorage.setItem(GKEY,JSON.stringify(
    {a:session.access_token,r:session.refresh_token,uid:session.user&&session.user.id,at:Date.now()}))}catch(e){}
}
/* إنقاذ: لو السباق لغى جلستنا، نرجّع آخر جلسة سليمة محفوظة عندنا */
let reviving=false;
async function reviveFromGood(){
  if(reviving)return false;
  let g=null;try{g=JSON.parse(localStorage.getItem(GKEY)||"null")}catch(e){}
  if(!g||!g.r||Date.now()-(g.at||0)>1000*60*60*24*20)return false;
  reviving=true;
  try{
    const {data,error}=await sb.auth.setSession({access_token:g.a,refresh_token:g.r});
    if(error||!data||!data.session){authLog("الإنقاذ بالنسخة المحفوظة فشل",{err:error?String(error.message||error):"مفيش جلسة"});
      return /rate limit|too many/i.test(String(error&&(error.message||error)||""))?"limited":false}
    authLog("اتنقذت الجلسة من النسخة المحفوظة");keepGood(data.session);acceptSession(data.session);return true;
  }catch(e){authLog("الإنقاذ رمى خطأ",{err:String(e&&e.message||e)});return false}
  finally{setTimeout(()=>{reviving=false},1500)}
}
/* ---------- تاب واحد بس هو اللي يجدّد التوكن ----------
   لما تفتح المنظومة في أكتر من تاب، كل تاب بيجدّد نفس الـ refresh token،
   و Supabase بيحظر الطلبات (Request rate limit) وبيلغي الجلسة. فبننتخب «قائد»:
   هو اللي بيجدّد، والباقي بيوقفوا التجديد خالص وبياخدوا الجلسة الجديدة من التخزين المشترك. */
const LKEY="hse.auth.leader";
let isLeader=null;   /* null = لسه ما اتقررش، عشان أول نبضة تطبّق الحالة */
function leaderNow(){try{return JSON.parse(localStorage.getItem(LKEY)||"null")}catch(e){return null}}
function claimLeader(){
  try{
    const L=leaderNow(),now=Date.now();
    if(L&&L.id!==TID&&now-(L.ts||0)<15000)return false;      /* فيه قائد حي */
    localStorage.setItem(LKEY,JSON.stringify({id:TID,ts:now}));
    const back=leaderNow();                                   /* تأكيد إننا كسبنا */
    return !!back&&back.id===TID;
  }catch(e){return true}
}
function leaderBeat(){
  const was=isLeader;
  isLeader=claimLeader();
  if(isLeader){try{localStorage.setItem(LKEY,JSON.stringify({id:TID,ts:Date.now()}))}catch(e){}}
  if(was!==isLeader){
    authLog(isLeader?"التاب ده بقى المسؤول عن تجديد الدخول":"تاب تاني بقى المسؤول عن التجديد — وقفنا التجديد هنا");
    if(!isLeader){try{sb.auth.stopAutoRefresh()}catch(e){}clearTimeout(myTimer)}
    else takeOverRefresh("بقينا المسؤول عن التجديد");  /* ما نسيبش الجلسة من غير تجديد */
  }
  return isLeader;
}
window.SBA.isLeader=()=>isLeader===true;
setInterval(leaderBeat,6000);

/* كام تاب مفتوح للمنظومة دلوقتي — أكتر من واحد بيزوّد احتمال السباق */
const TKEY="hse.tabs",TID=Math.random().toString(36).slice(2);
function tabPing(){
  try{
    const o=JSON.parse(localStorage.getItem(TKEY)||"{}"),now=Date.now();
    for(const k in o)if(now-o[k]>30000)delete o[k];
    o[TID]=now;localStorage.setItem(TKEY,JSON.stringify(o));
    return Object.keys(o).length;
  }catch(e){return 1}
}
window.SBA.tabCount=tabPing;
setInterval(tabPing,8000);
if(tabPing()>1)authLog("تنبيه: المنظومة مفتوحة في أكتر من تاب",{tabs:tabPing()});

/* ---------- فرق ساعة الجهاز عن السيرفر ----------
   لو ساعة الكمبيوتر مقدّمة، كل توكن جديد بيبان للمكتبة إنه خلصان خلاص،
   فتفضل تجدّد كل ثانية (عاصفة تجديد) لحد ما الجلسة تتلغي. بنقيس الفرق من
   ترويسة Date بتاعة السيرفر، وبنحسب ميعاد التجديد بالوقت الصح مش بوقت الجهاز. */
let skewMs=0,skewKnown=false;
async function measureSkew(){
  if(!NET())return null;
  try{
    const t0=Date.now();
    const r=await fetch(SB_URL+"/auth/v1/health",{cache:"no-store",headers:{apikey:SB_KEY}});
    const t1=Date.now(),h=r.headers.get("date");
    if(!h)return null;
    const srv=new Date(h).getTime();
    if(!srv||isNaN(srv))return null;
    skewMs=Math.round((t0+(t1-t0)/2)-srv);skewKnown=true;
    window.SBA.clockSkewSec=Math.round(skewMs/1000);
    authLog("فرق ساعة الجهاز عن السيرفر: "+window.SBA.clockSkewSec+" ثانية");
    if(Math.abs(skewMs)>120000){
      const mins=Math.round(Math.abs(skewMs)/60000);
      authLog("ساعة الجهاز فارقة عن السيرفر",{err:(skewMs>0?"مقدّمة ":"متأخرة ")+mins+" دقيقة"});
      takeOverRefresh("ساعة الجهاز فارقة "+mins+" دقيقة");
      clockBanner(skewMs>0,mins);
    }
    return skewMs;
  }catch(e){return null}
}
function clockBanner(ahead,mins){
  if(document.getElementById("clkBar"))return;
  const el=document.createElement("div");el.id="clkBar";
  el.style.cssText="position:fixed;inset-inline:0;top:0;z-index:10000;direction:rtl;background:#e8590c;color:#fff;padding:9px 14px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;font:600 13.5px 'IBM Plex Sans Arabic',system-ui";
  el.innerHTML='<span>\u26A0 ساعة الكمبيوتر '+(ahead?"مقدّمة":"متأخرة")+" "+mins+' دقيقة عن الوقت الصح — ده بيفصل الدخول. من إعدادات ويندوز: الوقت والتاريخ \u2190 «ضبط الوقت تلقائياً».</span>'+
    '<button onclick="document.getElementById(\'clkBar\').remove()" style="padding:5px 12px;border:0;border-radius:8px;background:#fff;color:#e8590c;font-weight:700;cursor:pointer">تمام</button>';
  document.body.appendChild(el);
}
/* بنمسك التجديد بنفسنا بدل المكتبة، وبنحسب الميعاد بالوقت المصحّح */
let myTimer=null,tookOver=false;
function takeOverRefresh(why){
  if(!tookOver){tookOver=true;authLog("مسكنا تجديد التوكن بنفسنا",{err:why});
    try{sb.auth.stopAutoRefresh()}catch(e){}}
  scheduleRefresh(window.SBA.session);
}
function scheduleRefresh(session){
  clearTimeout(myTimer);
  if(!tookOver||!session||!session.expires_at)return;
  /* expires_at بوقت السيرفر — بنحوّله لوقت الجهاز بإضافة الفرق */
  const dueLocal=session.expires_at*1000+skewMs;
  const wait=Math.min(3600000,Math.max(60000,dueLocal-Date.now()-300000));
  window.SBA.nextRefreshInSec=Math.round(wait/1000);
  myTimer=setTimeout(()=>{refreshOnce("ميعاد مجدول").catch(()=>{})},wait);
}
/* عاصفة تجديد: لو المكتبة جدّدت كذا مرة في ثواني، نوقفها ونمسكها بنفسنا */
const RBURST=[];
function noteRefresh(){
  const now=Date.now();RBURST.push(now);
  while(RBURST.length&&now-RBURST[0]>20000)RBURST.shift();
  if(RBURST.length>=5&&!window.SBA.__burstLogged){
    window.SBA.__burstLogged=true;setTimeout(()=>{window.SBA.__burstLogged=false},30000);
    authLog("عاصفة تجديد: "+RBURST.length+" تجديد في أقل من 20 ثانية"+(tookOver?" (التجديد عندنا أصلاً — يبقى جاي من تاب تاني)":" — وقفنا التجديد التلقائي"));
    if(!tookOver)takeOverRefresh("عاصفة تجديد");
    if(!skewKnown)measureSkew();
  }
}

/* ---------- بدل ما نرمي المستخدم بره: نشتغل بالنسخة المحفوظة قراءة بس ---------- */
const RKEY="hse.auth.lastReload";
const recentlyReloaded=()=>{try{return Date.now()-(+localStorage.getItem(RKEY)||0)<90000}catch(e){return false}};
const markReload=()=>{try{localStorage.setItem(RKEY,String(Date.now()))}catch(e){}};
function sessionBanner(reason){
  if(document.getElementById("sessBar"))return;
  const el=document.createElement("div");el.id="sessBar";
  el.style.cssText="position:fixed;inset-inline:0;top:0;z-index:10000;direction:rtl;background:#c92a2a;color:#fff;padding:9px 14px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;font:600 13px/1.5 'IBM Plex Sans Arabic',system-ui,sans-serif";
  el.innerHTML=`<span>⚠ ${esc2(reason)} — المنظومة شغالة بالبيانات المحفوظة على جهازك، <b>قراءة بس</b>.</span>
    <button onclick="SBA.freshLogin()" style="padding:5px 12px;border:0;border-radius:8px;background:#fff;color:#c92a2a;font-weight:700;cursor:pointer">سجّل دخول من جديد</button>`;
  document.body.appendChild(el);
}
window.SBA.freshLogin=async()=>{
  authLog("المستخدم طلب دخول جديد");
  try{localStorage.removeItem(PKEY);localStorage.removeItem(RKEY)}catch(e){}
  window.SBA.__bye=true;try{await sb.auth.signOut({scope:"local"})}catch(e){}
  location.reload();
};
async function degradeToCached(reason){
  let c=null;try{c=JSON.parse(localStorage.getItem(PKEY)||"null")}catch(e){}
  if(!c||!c.p||c.p.disabled)return false;
  window.SBA.user=window.SBA.user||{id:c.uid};
  window.SBA.profile=c.p;window.SBA.offlineProfile=true;window.SBA.readOnly=true;
  document.getElementById("gate")?.remove();
  readyResolve();badge();
  authLog("اشتغلنا بالنسخة المحفوظة (قراءة بس): "+reason);
  sessionBanner(reason);
  return true;
}

/* ---------- auth gate ---------- */
let readyResolve;const ready=new Promise(r=>readyResolve=r);
async function fn(action,payload){
  /* مش getSession: هي بتجدّد التوكن لوحدها لو خلص، وده بيعمل تجديد زيادة.
     بناخد الجلسة اللي ماسكينها، ولو مفيش بس ساعتها نسأل. */
  let session=window.SBA.session||null;
  if(!session){const g=await sb.auth.getSession();session=g&&g.data?g.data.session:null}
  const call=tok=>fetch(`${SB_URL}/functions/v1/admin-users`,{method:"POST",headers:{"Content-Type":"application/json",apikey:SB_KEY,Authorization:"Bearer "+(tok||SB_KEY)},body:JSON.stringify({action,...payload})});
  let r=await call(session?.access_token);
  let j={};try{j=await r.json()}catch(e){}
  if((r.status===401||r.status===403||j.error==="unauthorized")&&session){try{const rf=await refreshOnce("fn:"+action);if(rf&&rf.data&&rf.data.session)session=rf.data.session}catch(e){}r=await call(session?.access_token);j={};try{j=await r.json()}catch(e){}}
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
    ${(()=>{const L=window.SBA.authLog();if(!L.length)return "";
      const rows=L.slice(-25).reverse().map(x=>`<div style="padding:3px 0;border-bottom:1px solid #eee"><span style="color:#888">${esc2(x.t.slice(11,19))}</span> — ${esc2(x.m)}${x.err?` <span style="color:#c92a2a">(${esc2(x.err)})</span>`:""}</div>`).join("");
      return `<details style="margin-top:14px"><summary style="cursor:pointer;font-size:12.5px;color:#6b7a73">سجل الجلسة (${L.length}) — افتحه لو بيطلّعك فجأة</summary>
        <div style="max-height:190px;overflow:auto;font-size:11.5px;line-height:1.7;margin-top:6px;direction:ltr;text-align:left">${rows}</div>
        <button type="button" onclick="SBA.authLogClear();this.closest('details').remove()" style="margin-top:6px;padding:6px 10px;border:1px solid #cfd8d3;border-radius:8px;background:transparent;font-size:12px;cursor:pointer">امسح السجل</button></details>`})()}
  </form></div>`}
const esc2=t=>String(t==null?"":t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function showGate(message="",retrySession=null){
  let first=false;try{const {data}=await sb.rpc("has_admin");first=data===false}catch(e){}
  document.getElementById("gate")?.remove();document.body.insertAdjacentHTML("beforeend",gateHTML(first));
  const f=document.getElementById("gateForm"),msg=document.getElementById("gateMsg");
  if(message)msg.textContent=message;
  if(retrySession){const retry=document.createElement("button");retry.type="button";retry.textContent="إعادة المحاولة";retry.style.cssText="width:100%;margin-top:8px;padding:11px;border:1px solid #cfd8d3;border-radius:10px;background:transparent;font-size:14px;cursor:pointer";retry.onclick=()=>{retry.disabled=true;retry.textContent="جارٍ إعادة المحاولة…";started=false;activeUid="";acceptSession(retrySession)};f.appendChild(retry)}
  f.onsubmit=async e=>{e.preventDefault();msg.textContent="";const u=f.u.value.trim().toLowerCase(),p=f.p.value;
    try{if(first){if(p!==f.p2.value){msg.textContent="كلمتين السر مش زي بعض";return}await fn("bootstrap",{username:u,password:p})}
      const {error}=await sb.auth.signInWithPassword({email:emailOf(u),password:p});if(error)throw error;
    }catch(err){msg.textContent=window.SBA.ar(err)}};
}
const PKEY="hse.profile.cache";
async function loadProfile(uid){
  try{
    /* مش maybeSingle: لو الحساب له أكتر من صف في profiles كانت بترمي خطأ
       وتطلّع المستخدم بره على طول. بناخد الصفوف وننتقي الصح. */
    const {data:rows,error}=await sb.from("profiles").select("*").eq("user_id",uid).limit(5);
    if(error)throw error;
    let data=null;
    if(Array.isArray(rows)&&rows.length){
      data=rows.find(r=>r&&!r.disabled&&r.role==="admin")||rows.find(r=>r&&!r.disabled)||rows[0];
      if(rows.length>1)console.warn("في "+rows.length+" صفوف صلاحيات لنفس الحساب — اتاخد أعلاهم صلاحية. نضّف المكرر من جدول profiles.");
    }
    if(data){try{localStorage.setItem(PKEY,JSON.stringify({uid,p:data,at:Date.now()}))}catch(e){}}
    window.SBA.offlineProfile=false;
    return data;
  }catch(error){
    /* مفيش نت: نكمّل بآخر نسخة محفوظة من الصلاحيات بدل ما المنظومة تقفل في وشه */
    if(isNet(error)){
      try{const c=JSON.parse(localStorage.getItem(PKEY)||"null");
        if(c&&c.uid===uid&&c.p){window.SBA.offlineProfile=true;console.warn("الصلاحيات اتقرت من النسخة المحلية (مفيش نت)");return c.p}}catch(e){}
    }
    const e=new Error("Could not load the account profile");e.code="profile_load_failed";e.cause=error;throw e;
  }
}
async function afterLogin(session){
  window.SBA.user=session.user;const prof=await loadProfile(session.user.id);window.SBA.profile=prof;
  if(!prof||prof.disabled){document.getElementById("gate")?.remove();document.body.insertAdjacentHTML("beforeend",`<div id="gate" style="position:fixed;inset:0;z-index:9999;background:#f4f6f5;display:flex;align-items:center;justify-content:center;direction:rtl;font-family:system-ui;padding:16px"><div style="background:#fff;border-radius:16px;padding:26px;max-width:380px;text-align:center"><h2 style="font-size:17px">${prof?"حسابك موقوف":"الحساب ده مالوش صلاحيات"}</h2><p style="color:#6b7a73;font-size:14px">كلّم مدير المنظومة.</p><button onclick="SBA.logout().then(()=>location.reload())" style="padding:10px 18px;border:0;border-radius:10px;background:#d9480f;color:#fff">خروج</button></div></div>`);return}
  // Logging in keeps existing browser sessions intact.
  await cleanupOtherPushRows();
  document.getElementById("gate")?.remove();readyResolve();
  badge();if(NET())syncSoon(2500);
}
/* فتح المنظومة وانت مفيش نت خالص: بندخل بآخر صلاحيات محفوظة على الجهاز
   بدل ما شاشة الدخول تقفل في وشك وانت مش قادر توصل للسيرفر أصلاً */
async function offlineResume(){
  if(NET())return false;
  let c=null;try{c=JSON.parse(localStorage.getItem(PKEY)||"null")}catch(e){}
  if(!c||!c.p||c.p.disabled)return false;
  window.SBA.user={id:c.uid};window.SBA.profile=c.p;window.SBA.offlineProfile=true;
  document.getElementById("gate")?.remove();readyResolve();badge();
  console.warn("دخول بدون نت بآخر صلاحيات محفوظة على الجهاز");
  return true;
}
let started=false,activeUid="",loginFlow=Promise.resolve();
function acceptSession(session){
  if(!session){offlineResume().then(done=>{if(!done)showGate()});return}
  window.SBA.session=session;keepGood(session);scheduleRefresh(session);
  if(started&&activeUid===session.user?.id)return;
  started=true;activeUid=session.user?.id||"";
  // Supabase auth callbacks run under its auth lock. Defer all follow-up Supabase calls.
  loginFlow=loginFlow.catch(()=>{}).then(()=>new Promise(resolve=>setTimeout(resolve,0)))
    .then(()=>afterLogin(session))
    .catch(async e=>{console.error("Session initialization failed",e);started=false;activeUid="";
      authLog("فشل تجهيز الجلسة",{err:String(e&&e.message||e)});
      if(await degradeToCached("تعذرت قراءة ملف الصلاحيات من السيرفر"))return;
      await showGate("تم تسجيل الدخول لكن تعذرت قراءة ملف الصلاحيات من Supabase. الجلسة محفوظة؛ راجع سجل profiles وسياسات RLS ثم أعد المحاولة.",session)});
}
sb.auth.onAuthStateChange((ev,session)=>{
  authLog("حدث: "+ev,{session:!!session,uid:session?.user?.id||null});
  if(ev==="TOKEN_REFRESHED")noteRefresh();
  if(session)acceptSession(session);
  else if(ev==="SIGNED_OUT"){
    /* مش كل SIGNED_OUT معناه إن المستخدم عايز يخرج — ساعات التوكن بيفشل في التجديد.
       بنجرّب نجدّد مرة واحدة قبل ما نرميه على شاشة الدخول. */
    if(window.SBA.__bye){authLog("خروج مؤكد — تنضيف وإعادة تحميل");try{localStorage.removeItem(PKEY)}catch(e){}cleanupLocalPush().finally(()=>location.reload());return}
    if(window.SBA.__recovering){authLog("معالجة خروج شغالة بالفعل — ما كررناهاش");return}
    window.SBA.__recovering=true;
    (async()=>{
      let rescued=false,limited=false;
      const isLimit=e=>/rate limit|too many/i.test(String(e&&(e.message||e)||""));
      try{const rf=await refreshOnce("signed_out");
        if(rf&&rf.data&&rf.data.session){authLog("اتنقذت الجلسة بتجديد التوكن");rescued=true;keepGood(rf.data.session);acceptSession(rf.data.session)}
        else {authLog("التجديد ما رجّعش جلسة",{err:rf&&rf.error?String(rf.error.message||rf.error):null});
          if(rf&&rf.error&&isLimit(rf.error))limited=true}
      }catch(e){authLog("التجديد رمى خطأ",{err:String(e&&e.message||e)});if(isLimit(e))limited=true}
      /* السباق بيخلي التجديد يفشل والجلسة تتمسح — نرجّعها من نسختنا قبل أي خروج */
      if(!rescued&&isLeader!==true){      /* تاب تابع: استنى القائد يجدّد وبعدين خد الجلسة منه */
        authLog("مستنيين التاب المسؤول يجدّد");
        await new Promise(r=>setTimeout(r,2500));
      }
      if(!rescued){const rv=await reviveFromGood();if(rv===true)rescued=true;else if(rv==="limited")limited=true}
      /* Supabase حاظر الطلبات من كتر التجديد — الجلسة مش بالضرورة ماتت.
         ما نرميهوش بره: نشتغل قراءة بس ونجرّب تاني بعد شوية. */
      if(!rescued&&limited){
        window.SBA.__recovering=false;
        authLog("Supabase حاظر الطلبات مؤقتاً — مش هنطلّعك بره");
        if(await degradeToCached("السيرفر حاظر الطلبات مؤقتاً من كتر محاولات التجديد"))
          {setTimeout(()=>{reviveFromGood().catch(()=>{})},65000);return}
      }
      if(!rescued){
        /* مرة واحدة بس نجرّب إعادة التحميل. لو اتكررت في أقل من دقيقة ونص،
           يبقى فيه لفة — نوقفها ونشتغل بالنسخة المحفوظة بدل ما نفضل نرمي المستخدم بره. */
        if(recentlyReloaded()){
          authLog("لفة خروج متكررة — وقفناها");
          if(await degradeToCached("الجلسة انتهت وما قدرناش نجدّدها"))return;
        }
        authLog("الجلسة انتهت — رجوع لشاشة الدخول");
        try{sessionStorage.setItem("hse.session.enforce.error","الجلسة انتهت وما قدرناش نجدّدها. سجّل دخول تاني — وفي شاشة الدخول تحت هتلاقي «سجل الجلسة».")}catch(e){}
        try{localStorage.removeItem(PKEY)}catch(e){}
        markReload();
        cleanupLocalPush().finally(()=>location.reload());
      }
      window.SBA.__recovering=false;
    })();
  }
});
leaderBeat();
measureSkew().catch(()=>{});
sb.auth.getSession().then(async({data:{session},error})=>{if(error)throw error;if(session)acceptSession(session);else if(!await offlineResume())showGate()})
  .catch(async e=>{console.error("Could not restore auth session",e);
    if(await offlineResume())return;
    showGate("تعذر استعادة الجلسة. سجّل الدخول مرة أخرى.")});

/* ---------- document store ---------- */
const PAGE=1000;
async function fetchCol(col){let out=[],from=0;for(;;){const {data,error}=await sb.from("docs").select("id,data").eq("col",col).range(from,from+PAGE-1);if(error)throw error;out=out.concat(data);if(data.length<PAGE)break;from+=PAGE}return out}
async function fetchProfiles(){const {data,error}=await sb.from("profiles").select("*");if(error)throw error;return data.map(p=>({id:p.user_id,data:p}))}
/* قراءة مع نسخة احتياطية محلية: لو النت موجود بنجيب ونحدّث النسخة، ولو مقطوع بنقرا النسخة */
async function pullCol(col){
  const net=col==="__profiles"?fetchProfiles:()=>fetchCol(col);
  try{
    if(!NET())throw new Error("offline");
    const rows=await net();
    cacheReplaceCol(col,rows).catch(()=>{});
    return {rows,fromCache:false};
  }catch(e){
    const rows=await cacheCol(col);
    if(rows&&rows.length)return {rows,fromCache:true};
    throw e;
  }
}
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
    pullCol(col).then(async({rows,fromCache})=>{S.map.clear();for(const r of rows)S.map.set(r.id,r.data);
      await overlayPending(col,S.map);S.loaded=true;S.fromCache=fromCache;S.emit();if(fromCache)badge()})
      .catch(e=>{console.error(e);err&&err(e)})}
  S.cbs.add(cb);if(S.loaded)S.emit();
  return ()=>S.cbs.delete(cb);
}
const rid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)).replace(/-/g,"").slice(0,20);
function local(col,id,data){const S=subs[col];if(!S)return;if(data===null)S.map.delete(id);else S.map.set(id,data);S.emit()}
/* التغييرات اللي لسه في الطابور بتتحط فوق أي نسخة جاية من السيرفر */
async function overlayPending(col,map){
  const ops=await outAll();
  for(const o of ops){if(o.col!==col)continue;if(o.op==="set")map.set(o.id,o.data);else if(o.op==="del")map.delete(o.id)}
}
async function getDoc(col,id){
  try{
    if(!NET())throw new Error("offline");
    if(col==="private"){const {data,error}=await sb.from("private_docs").select("data").eq("id",id).maybeSingle();if(error)throw error;const v=data?data.data:null;if(v!==null)cachePut(col,id,v).catch(()=>{});return v}
    const {data,error}=await sb.from("docs").select("data").eq("col",col).eq("id",id).maybeSingle();if(error)throw error;
    const v=data?data.data:null;if(v!==null)cachePut(col,id,v).catch(()=>{});return v;
  }catch(e){
    if(!isNet(e))throw e;
    return await cacheGet(col,id);
  }
}
async function pushSet(col,id,data,at){
  if(col==="private"){const {error}=await sb.from("private_docs").upsert({id,data});if(error)throw norm(error);return}
  const {error}=await sb.from("docs").upsert({col,id,data,updated_at:new Date(at||Date.now()).toISOString()});if(error)throw norm(error);
}
async function pushDel(col,id){
  if(col==="private"){const {error}=await sb.from("private_docs").delete().eq("id",id);if(error)throw norm(error);return}
  const {error}=await sb.from("docs").delete().eq("col",col).eq("id",id);if(error)throw norm(error);
}
async function setDoc(col,id,data){
  if(window.SBA.readOnly)throw Object.assign(new Error("الجلسة انتهت — سجّل دخول من جديد عشان تقدر تحفظ"),{code:"read_only"});
  const prev=await cacheGet(col,id);
  await cachePut(col,id,data);local(col,id,data);          /* يتسجل محلياً فوراً */
  try{
    if(!NET())throw new Error("offline");
    await pushSet(col,id,data);
  }catch(e){
    if(!isNet(e)){                                          /* رفض صلاحيات أو خطأ حقيقي: نرجّع الوضع ونبلّغ */
      if(prev===null||prev===undefined)await cacheDel(col,id);else await cachePut(col,id,prev);
      local(col,id,prev===undefined?null:prev);throw e;
    }
    await outAdd({op:"set",col,id,data,at:Date.now()});syncSoon();badge();
  }
}
async function delDoc(col,id){
  if(window.SBA.readOnly)throw Object.assign(new Error("الجلسة انتهت — سجّل دخول من جديد عشان تقدر تمسح"),{code:"read_only"});
  const prev=await cacheGet(col,id);
  await cacheDel(col,id);local(col,id,null);
  try{
    if(!NET())throw new Error("offline");
    await pushDel(col,id);
  }catch(e){
    if(!isNet(e)){if(prev!==null&&prev!==undefined){await cachePut(col,id,prev);local(col,id,prev)}throw e}
    await outAdd({op:"del",col,id,at:Date.now()});syncSoon();badge();
  }
}
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

/* ================= محرك المزامنة التلقائية ================= */
let syncing=false,syncT=0,parked=[];
function syncSoon(ms=1200){clearTimeout(syncT);syncT=setTimeout(()=>{syncNow()},ms)}
async function repull(){
  for(const col of Object.keys(subs)){
    const S=subs[col];if(!S||!S.cbs.size)continue;
    try{const {rows}=await pullCol(col);S.map.clear();for(const r of rows)S.map.set(r.id,r.data);await overlayPending(col,S.map);S.fromCache=false;S.emit()}
    catch(e){/* لسه مفيش نت */ break}
  }
}
async function syncNow(){
  if(syncing)return {skipped:true};
  if(!NET()){badge();return {offline:true}}
  syncing=true;badge();
  let sent=0,failed=0,stopped=false;
  try{
    const ops=await outAll()||[];
    for(const o of ops){
      try{
        if(o.op==="set")await pushSet(o.col,o.id,o.data,o.at);
        else if(o.op==="del")await pushDel(o.col,o.id);
        else if(o.op==="upload"){
          const b=await blobGet(o.id);
          if(b&&b.blob){const {error}=await sb.storage.from("files").upload(o.id,b.blob,{contentType:b.type,upsert:true});if(error)throw Object.assign(new Error(error.message),{code:"upstream_error"})}
          await blobDel(o.id);urlCache.delete(o.id);localURL.delete(o.id);
        }
        await outDel(o.seq);sent++;
      }catch(e){
        if(isNet(e)){stopped=true;break}                 /* النت قطع تاني: نسيب الباقي بترتيبه */
        await outDel(o.seq);failed++;
        parked.push({op:o.op,col:o.col,id:o.id,at:o.at,msg:(e&&e.message)||"خطأ"});
        console.error("تغيير مرفوض من السيرفر",o,e);
      }
    }
    if(!stopped){await metaSet("lastSync",Date.now());await repull();
      try{dispatchEvent(new CustomEvent("hse:synced",{detail:{sent,failed}}))}catch(e){}}
  }finally{syncing=false;badge()}
  if(failed)console.warn("تغييرات اترفضت:",parked.slice(-failed));
  return {sent,failed,stopped};
}
/* ---------- شارة الحالة ---------- */
let badgeT=0;
function badge(){clearTimeout(badgeT);badgeT=setTimeout(async()=>{
  const n=await outCount();const off=!NET();
  let el=document.getElementById("hseSyncBadge");
  const show=off||n>0||syncing||parked.length;
  if(!show){el&&el.remove();return}
  if(!el){el=document.createElement("div");el.id="hseSyncBadge";
    el.style.cssText="position:fixed;inset-inline-start:12px;bottom:12px;z-index:9998;direction:rtl;font:600 12.5px/1.5 'IBM Plex Sans Arabic',system-ui,sans-serif;padding:7px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.14);cursor:pointer;user-select:none;max-width:72vw";
    el.title="اضغط للمزامنة دلوقتي";el.onclick=()=>{parked=[];syncNow()};document.body.appendChild(el)}
  let bg="#fff4e6",fg="#9c4221",txt="";
  if(syncing){bg="#e7f5ff";fg="#1864ab";txt="⟳ بيزامن…"}
  else if(off)txt="⚡ شغال من غير نت"+(n?` · ${n} تغيير مستني`:" · كل حاجة متسجلة");
  else if(n)txt=`⬆ ${n} تغيير مستني الرفع — اضغط للمزامنة`;
  else if(parked.length){bg="#fff5f5";fg="#c92a2a";txt=`⚠ ${parked.length} تغيير اترفض من السيرفر`}
  el.style.background=bg;el.style.color=fg;el.style.border="1px solid "+fg+"33";el.textContent=txt;
},150)}
addEventListener("online",()=>{badge();syncNow()});
addEventListener("offline",()=>badge());
setInterval(()=>{if(NET())outCount().then(n=>{if(n)syncNow()})},60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&NET())syncSoon(400)});
window.SBA.sync={now:syncNow,pending:outCount,parked:()=>parked.slice(),lastSync:()=>metaGet("lastSync"),online:NET};
window.SBA.store={get:metaGet,set:metaSet};

/* ---------- files (assets) ---------- */
const urlCache=new Map();
const localURL=new Map();
async function signed(id){
  /* مرفوع محلياً ولسه ما اترفعش للسيرفر: نعرضه من الجهاز */
  if(localURL.has(id))return localURL.get(id);
  const b=await blobGet(id);
  if(b&&b.blob){const u=URL.createObjectURL(b.blob);localURL.set(id,u);return u}
  if(urlCache.has(id))return urlCache.get(id);
  const p=(async()=>{const {data,error}=await sb.storage.from("files").createSignedUrl(id,60*60*12);if(error)throw error;return data.signedUrl})();
  urlCache.set(id,p);try{return await p}catch(e){urlCache.delete(id);throw e}}
window.SBA.signed=signed;
const assets={
  upload:async(blob,opt={})=>{const type=opt.type||blob.type||"application/octet-stream";const id=rid()+({"image/jpeg":".jpg","image/png":".png","image/webp":".webp","application/pdf":".pdf"}[type]||"");
    try{
      if(!NET())throw new Error("offline");
      const {error}=await sb.storage.from("files").upload(id,blob,{contentType:type,upsert:false});
      if(error)throw Object.assign(new Error(error.message),{code:/size/i.test(error.message)?"too_large":"upstream_error"});
      return {id,url:"_blob/"+id,sizeBytes:blob.size,contentType:type};
    }catch(e){
      if(!isNet(e))throw e;
      /* مفيش نت: نحفظ الملف على الجهاز ونرفعه أول ما النت يرجع */
      await blobPut(id,blob,type);await outAdd({op:"upload",id,type,at:Date.now()});syncSoon();badge();
      return {id,url:"_blob/"+id,sizeBytes:blob.size,contentType:type,pending:true};
    }},
  list:async()=>({assets:[],usage:{}}),
  delete:async id=>{
    const b=await blobGet(id);
    if(b){const ops=await outAll()||[];for(const o of ops)if(o.op==="upload"&&o.id===id)await outDel(o.seq);await blobDel(id);localURL.delete(id);badge();return {deleted:true}}
    await sb.storage.from("files").remove([id]);return {deleted:true}}
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
