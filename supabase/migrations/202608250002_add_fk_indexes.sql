-- Supabase performance advisor 권장 외래키 인덱스
create index if not exists claims_draft_id_idx on public.claims(draft_id);
create index if not exists evidence_source_id_idx on public.evidence(source_id);
create index if not exists router_decisions_ai_run_id_idx on public.router_decisions(ai_run_id);
create index if not exists verification_results_draft_id_idx on public.verification_results(draft_id);
