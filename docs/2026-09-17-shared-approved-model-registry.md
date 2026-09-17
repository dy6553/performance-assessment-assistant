# 시험온 공통 승인 모델 Registry 동기화

적용일: 2026-09-17

## 변경 내용

- 수행도우미가 자체적으로 모델 승인 여부를 다시 결정하는 대신 시험온의 공통 승인 목록을 기준으로 사용하도록 변경했다.
- 중앙 Source of Truth는 시험온의 `GET /api/model-registry/approved`이다.
- 일일 모델 카탈로그 Cron과 관리자 수동 갱신은 NVIDIA 모델 발견 목록을 갱신한 뒤 `syncSharedApprovedModelRegistry()`로 시험온 승인 목록을 로컬 Supabase에 캐시한다.
- 공통으로 동기화하는 값은 승인/활성 여부, 개발사/국가, 한국어·Structured Output 등 capability, live catalog 상태다.
- 수행도우미의 `evaluation_profile_json`에 있는 task affinity, 과목/형식/난이도, quality tier, priority 등 역할별 라우팅 값은 유지한다.
- 중앙 Registry 호출 실패 시 로컬 승인 목록을 임의로 변경하지 않고 동기화 실패로 처리한다.

## 현재 기준

적용 시점 시험온에는 승인·활성 모델이 11개 있고, 이 중 NVIDIA live catalog에서 사용 가능한 모델은 10개다. 수행도우미의 공통 허용 목록은 이 10개와 일치하도록 동기화한다.

## 기존 차이

변경 전 두 서비스 모두 live 승인 모델 수는 10개였지만 구성은 1개 달랐다. 시험온에는 `nvidia/nemotron-3-ultra-550b-a55b`, 수행도우미에는 `mistralai/mistral-nemotron`이 포함되어 있었다. 공통 Registry 적용 후 승인 목록은 시험온 기준으로 통일하고, 실제 역할 배정만 수행도우미 라우터가 별도로 결정한다.
