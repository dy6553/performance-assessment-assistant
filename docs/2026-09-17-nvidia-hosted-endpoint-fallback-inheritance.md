# 2026-09-17 NVIDIA Hosted Endpoint Fallback 정책 연동

## 구조

수행도우미는 NVIDIA 모델을 별도로 강제 승인하지 않고 시험온의 공통 승인 Registry를 Source of Truth로 사용한다.

시험온 자동 심사에는 Hosted endpoint fallback 정책이 추가되었다.

- 기본 Chat Completions 실패 후 `chat/completions`, `responses`, `completions` 경로를 재검증
- 404, 410, 5xx, timeout 등 Hosted 경로 문제는 즉시 성능 탈락으로 확정하지 않음
- 모든 Hosted 경로가 실패하면 재심사 대기 상태로 유지
- 실제 생성 성공 후 한국어 독해, 교정/OCR 자연화, 자료 충실성, 환각 억제, 교과 추론, Structured Output 기준을 통과한 모델만 Production 승인
- 실제 API는 동작하지만 한국어/구조화 출력 기준을 실패한 경우에만 capability 탈락으로 확정

## 수행도우미 반영 방식

시험온에서 신규 모델이 최종 Production 승인되면 수행도우미의 기존 shared model registry 동기화가 해당 모델을 받아 로컬 `model_registry`에 반영한다.

수행도우미의 역할별 `evaluation_profile_json`과 task-routing 프로필은 가능한 범위에서 유지하고, 공통 승인/해제 상태만 시험온 Registry를 따른다.

따라서 수행도우미도 앞으로 단순 404 때문에 좋은 모델을 영구 제외하지 않고, 시험온에서 Hosted 경로 재검증을 끝낸 승인 결과를 사용한다.
