const SHARED_URL=(process.env.SHARED_MODEL_REGISTRY_URL||'https://siheomon-study-app-six.vercel.app/api/model-registry/approved').replace(/\/$/,'');
const SUPABASE_URL=(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.supabase_URL||'').trim().replace(/\/$/,'');
const KEY=(process.env.SUPABASE_SECRET_KEY||process.env.sb_secret_key||'').trim();
if(!SUPABASE_URL||!KEY) throw new Error('missing Supabase production credentials');
const headers=(extra={})=>({apikey:KEY,Accept:'application/json',...(KEY.split('.').length===3?{Authorization:`Bearer ${KEY}`}:{}) ,...extra});
const shared=await fetch(SHARED_URL,{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000)}).then(async r=>{if(!r.ok)throw new Error(`shared registry ${r.status}`);return r.json()});
if(shared?.success!==true||!Array.isArray(shared.models)||!shared.models.length) throw new Error('invalid shared registry');
let synced=0;
for(const m of shared.models){
  if(!m?.modelId||!Array.isArray(m.capabilities)||!m.capabilities.includes('korean')||!m.capabilities.includes('structured_output')) continue;
  const body={provider:'nvidia',enabled:true,developer_company:m.developerCompany,country_of_headquarters:m.countryOfHeadquarters,china_origin_excluded:true,approved_provider:true,approved_model:true,allowed_for_student_data:true,security_review_passed:true,privacy_policy_verified:true,deprecated:false,capabilities_json:m.capabilities,production_approved:true,catalog_available:true,catalog_source:'shared_siheomon_registry',updated_at:new Date().toISOString()};
  const q=new URLSearchParams({model_id:`eq.${m.modelId}`,provider:'eq.nvidia',select:'model_id'});
  const p=await fetch(`${SUPABASE_URL}/rest/v1/model_registry?${q}`,{method:'PATCH',headers:headers({'Content-Type':'application/json',Prefer:'return=representation'}),body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!p.ok)throw new Error(`patch ${m.modelId} ${p.status}`);
  const rows=await p.json();
  if(!rows.length){
    const ins=await fetch(`${SUPABASE_URL}/rest/v1/model_registry`,{method:'POST',headers:headers({'Content-Type':'application/json',Prefer:'return=minimal'}),body:JSON.stringify({model_id:m.modelId,...body,evaluation_profile_json:{sharedRegistrySource:'siheomon'}}),signal:AbortSignal.timeout(10000)});
    if(!ins.ok)throw new Error(`insert ${m.modelId} ${ins.status}`);
  }
  synced++;
}
console.log(`[shared-registry-sync] approved=${synced} source=siheomon checkedAt=${shared.checkedAt||'unknown'}`);
console.log(`[shared-registry-sync] models=${shared.models.map(m=>m.modelId).join(',')}`);
