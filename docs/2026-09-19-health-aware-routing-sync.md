# 2026-09-19 시험온 Health 기반 AI 라우팅 동기화

## 변경 내용

- 시험온 공용 승인 Registry v2에서 모델별 health snapshot을 함께 동기화한다.
- 동기화 항목은 health score, 최근 성공률, 평균 응답 지연시간, circuit breaker 종료 시각, 마지막 상태 점검 시각이다.
- 수행도우미의 기존 task/과목/형식/난이도 affinity와 quality tier, priority는 유지하고 health 정보만 병합한다.
- 일반 AI 라우팅 점수에 health score와 최근 성공률을 가산하고, 평균 지연시간이 긴 모델은 동일 조건에서 소폭 감점한다.
- circuit breaker가 열린 모델은 승인 자체를 취소하지 않고 해당 라우팅 시점의 후보에서 임시 제외한다.
- 모든 승인 모델이 동시에 circuit-open이면 서비스 중단 방지를 위해 승인 목록 전체로 fallback한다.

## 동기화 주기

- 시험온은 모델 카탈로그 갱신 시 승인 모델 health check를 매일 자동 실행한다.
- 수행도우미는 기존 03:00 UTC 일일 동기화에서 시험온 공용 승인/health 정보를 함께 가져온다.
- OCR 기본/검증 모델 순위는 기존처럼 시험온의 별도 OCR 점수 API를 실시간으로 사용한다.

## 라우팅 효과

기존 priority와 작업 적합도만으로 선택하던 방식에 실제 endpoint 안정성이 추가된다. 최근 연속 오류가 있는 모델은 자동으로 잠시 빠지고, 다음 점검에서 정상 응답하면 자동으로 복귀한다.

## 배포 트리거 확인

- GitHub Contents API 커밋으로 production 자동 배포가 시작되도록 최종 변경을 기록했다.

## Vercel Cron 제한 반영

- 현재 배포 플랜의 Cron 제약 때문에 수행도우미 동기화 주기는 기존 03:00 UTC 하루 1회를 유지한다.
- health 기반 라우팅 기능 자체는 그대로 유지하며, 매일 시험온에서 새로 계산된 health snapshot을 동기화해 사용한다.

- Cron 제약 반영 후 production 재배포를 위해 최종 커밋을 생성했다.

## 초기 Health 동기화

- 시험온에서 첫 health snapshot을 생성한 직후 수행도우미에도 바로 반영하기 위해 SHA-256 해시로 보호된 1회성 수동 동기화 경로를 임시 추가한다.
- 원문 토큰은 저장소에 기록하지 않으며 최초 동기화가 끝난 뒤 수동 경로를 제거한다.

### 초기 Health 동기화 결과

- 시험온의 공용 승인/health Registry를 즉시 동기화했고 수행도우미 로컬 Registry에 승인 모델 11개를 반영했다.
- 기존 로컬 승인 목록과 중앙 목록 차이 1개는 자동 revoke 처리했다.
- 실제 health 값이 동기화돼 수행도우미 라우터가 즉시 성공률·지연시간 기반 점수를 사용할 수 있다.
- 현재 상위 health는 DiffusionGemma 0.9987, Ising Calibration 0.9975, Gemma 4 0.9971, Nemotron 3 Super 0.9968이다.
- 1회성 수동 동기화 경로는 실행 직후 제거하고 다시 CRON_SECRET 인증만 허용한다.
