# Shared Registry NVIDIA Hosted 판정 변경 — 2026-09-18

시험온 중앙 Registry에서 NVIDIA 모델의 실제 Hosted 가용성 판정 방식을 수정했다.

## 원인

NVIDIA의 `/v1/models` 및 Build 표시가 실제 `integrate.api.nvidia.com` inference endpoint 수명 상태와 일치하지 않는 경우가 확인됐다.

시험온 Production 동일 API 키로 직접 비교한 결과:

- 승인 canary `nvidia/nemotron-3.5-lightning-30b-a3b`: HTTP 200
- `meta/llama-3.2-1b-instruct`: HTTP 410 EOL
- `meta/llama-3.2-3b-instruct`: HTTP 410 EOL

따라서 계정/API 키 전체 문제는 아니며 모델별 Hosted lifecycle/배포 매핑 문제다.

## 중앙 Registry 변경

시험온 정책 `2026-09-18.1-hosted-api-authoritative`부터:

- 실제 NVIDIA inference API 응답을 최종 가용성 근거로 사용
- 410 EOL은 재시도하지 않고 후보에서 제외
- 404는 Hosted not found / function mapping으로 구분
- 429/5xx/timeout만 transient/backoff 처리
- `/v1/models`는 discovery 용도로만 사용
- 승인 모델을 `/v1/models` 부재만으로 제거하지 않음
- policyVersion + internalEvalScore 증거가 없는 legacy approval row는 Shared Registry에 노출하지 않음

증거 없는 `nvidia/nemotron-3-nano-30b-a3b` legacy 승인값도 후보 상태로 되돌려 중앙 승인 수를 12개로 복구했다.

## 수행도우미 영향

수행도우미는 중앙 Shared Approved Registry를 그대로 동기화하므로
별도 NVIDIA Hosted 판정 로직을 중복 구현하지 않는다.

로컬 task affinity / role routing은 유지하고,
중앙에서 승인된 모델 집합만 사용한다.
