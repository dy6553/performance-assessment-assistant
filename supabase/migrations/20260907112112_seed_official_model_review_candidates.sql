-- Seed NVIDIA-documented endpoints as review candidates.
-- This does not approve a model. Runtime use still requires the automated
-- operational, Korean, structured-output and faithfulness checks.
select public.sync_nvidia_model_catalog(
  array[
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'nvidia/nemotron-3-ultra-550b-a55b',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'meta/muse-glimmer-30b',
    'google/gemma-3-27b-it',
    'google/gemma-4-31b-it',
    'mistralai/mistral-large-3-675b-instruct-2512',
    'mistralai/ministral-14b-instruct-2512'
  ]::text[],
  now()
);
