-- Retire NVIDIA endpoints that now return HTTP 410 and approve the current
-- NVIDIA-hosted replacement after provider/privacy review. Production still
-- intersects this registry with NVIDIA's live model catalog before routing.

update public.model_registry
set
  enabled = false,
  deprecated = true,
  production_approved = false,
  catalog_available = false,
  evaluation_profile_json = evaluation_profile_json || jsonb_build_object(
    'status', 'retired_endpoint_http_410',
    'retiredObservedAt', now()
  ),
  updated_at = now()
where model_id in (
  'nvidia/nemotron-3-nano-30b-a3b',
  'nvidia/nemotron-3-super-120b-a12b'
);

update public.model_registry
set
  enabled = true,
  approved_model = true,
  allowed_for_student_data = true,
  deprecated = false,
  capabilities_json = jsonb_build_object(
    'korean', true,
    'reasoning', true,
    'structured_output', true,
    'long_context', true
  ),
  evaluation_profile_json = jsonb_build_object(
    'qualityTier', 'high',
    'priority', 100,
    'taskAffinity', jsonb_build_array(
      'task_parser',
      'strategy',
      'writer',
      'logic_critic',
      'curriculum_verifier',
      'rubric_grader',
      'final_rewriter'
    ),
    'subjectAffinity', jsonb_build_array('all'),
    'formatAffinity', jsonb_build_array('all'),
    'difficultyMin', 1,
    'difficultyMax', 7,
    'dataPolicy', 'deidentified_non_sensitive_student_content_only',
    'status', 'approved_after_korean_structured_output_smoke_test',
    'reviewBasis', 'NVIDIA model card + current API Trial Terms + Korean structured-output smoke test'
  ),
  production_approved = true,
  updated_at = now()
where model_id = 'nvidia/nemotron-3.5-lightning-30b-a3b';
