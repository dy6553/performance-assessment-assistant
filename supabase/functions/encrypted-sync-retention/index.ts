import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type Candidate = { storagePath: string };

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return Response.json({ error: "SERVER_CONFIGURATION" }, { status: 500 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const candidates = await supabase.rpc("sync_retention_storage_candidates");
  if (candidates.error) return Response.json({ error: candidates.error.message }, { status: 500 });
  const paths = [...new Set(((Array.isArray(candidates.data) ? candidates.data : []) as Candidate[]).map((item) => item.storagePath).filter(Boolean))];
  if (paths.length) {
    const removal = await supabase.storage.from("encrypted-sync-files").remove(paths);
    if (removal.error) return Response.json({ error: removal.error.message }, { status: 502 });
  }
  const finalized = await supabase.rpc("sync_finalize_retention", { p_storage_paths: paths });
  if (finalized.error) return Response.json({ error: finalized.error.message }, { status: 500 });
  return Response.json({ ok: true, storageObjectsDeleted: paths.length, ...finalized.data });
});
