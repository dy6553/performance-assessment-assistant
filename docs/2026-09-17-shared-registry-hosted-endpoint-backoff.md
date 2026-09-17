# 2026-09-17 시험온 Shared Registry Hosted Endpoint backoff 반영

## 변경 배경

시험온의 NVIDIA 모델 자동심사에서 `GET /v1/models`에 노출된 일부 과거 모델이 실제 `/v1/chat/completions`, `/v1/responses`, `/v1/completions`에서는 모두 HTTP 404를 반환하는 문제가 확인됐다.

원인은 NVIDIA 카탈로그 노출과 실제 Hosted Free Endpoint 가용성이 동일하지 않기 때문이다. 시험온은 이를 해결하기 위해 실제 생성 호출을 Hosted 가용성의 최종 기준으로 사용하고, 반복 404/410/5xx/timeout 모델에는 점진적 backoff를 적용한다.

## 시험온 Source of Truth 정책

- 카탈로그 노출은 후보 발견 용도
- 실제 POST 성공 후에만 한국어/구조화 출력 심사 수행
- Hosted endpoint 미가용은 한국어 성능 탈락으로 기록하지 않음
- 연속 endpoint 미가용 시 1일 → 3일 → 7일 간격으로 재확인
- backoff 기간에는 해당 모델을 자동심사 슬롯에서 제외
- endpoint가 다시 열리면 자동 재심사

## 수행도우미 영향

수행도우미는 시험온의 공개 승인 Registry를 동기화하므로 별도의 중복 Hosted 심사 로직을 추가하지 않는다.

현재 시험온의 live production-approved Registry는 12개이며, 수행도우미도 동일한 승인 집합을 사용한다. Hosted endpoint가 없는 24개 후보는 시험온 중앙 Registry에서 backoff 처리되며 수행도우미로 승인 모델처럼 전파되지 않는다.

수행도우미의 기존 로컬 task affinity / role routing profile은 Shared Registry 동기화 시 유지한다.

## 목적

Deprecated 또는 stale NVIDIA 카탈로그 항목 때문에 중앙 심사 자원을 반복 소비하는 것을 막고, 실제로 사용 가능한 신규 Hosted 모델의 심사를 우선한다.
