# 2026-09-19 역할별 모델 승인 동기화

## 목적

시험온에서 확대된 역할별 승인 모델을 수행도우미에서도 안전하게 활용한다. 모델 전체를 모든 작업에 허용하지 않고 중앙 Registry가 승인한 역할만 로컬 라우터에 전달한다.

## 동기화

시험온 공용 Registry v3에서 capabilities, workloads, qualityTier, priority, health를 가져온다. Structured Output이 없는 모델도 한국어 text_generation 역할이 승인되어 있으면 수행도우미 Registry에 들어올 수 있다.

## Task별 후보

- task_parser / rubric_grader: structured_json 역할 필수.
- logic_critic: reasoning 역할 필수.
- curriculum_verifier: independent_review 역할 필수.
- strategy / writer / final_rewriter: text_generation 또는 writer 역할.
- 역할 후보가 존재하면 역할이 맞지 않는 모델은 라우팅 후보에서 제외한다.
- circuit breaker와 health 점수, 속도 점수는 기존대로 함께 적용한다.

## 효과

JSON 형식이 약한 모델을 Writer에 활용하면서도 파서나 채점기에 잘못 배치하지 않는다. 반대로 추론·독립검수 검증을 통과한 모델은 해당 단계에 우선 배치할 수 있어 승인 모델 수와 실제 활용률을 동시에 늘린다.

## 전환 호환성

공유 Registry의 `sharedWorkloads`가 있으면 과거 로컬 taskAffinity보다 중앙 역할 정보를 우선한다. 따라서 이전 승인 기록에 남아 있던 넓은 taskAffinity가 새 역할 제한을 우회하지 않는다.
