# 우선 개발사 모델의 한국어 중심 승인 정책

적용일: 2026-09-17

## 변경 목적

기존 NVIDIA 모델 자동 승인 흐름, 재심사 주기, 동시성, 점수 기준은 유지하면서 NVIDIA, OpenAI, Google, Meta, Microsoft, Mistral AI 모델을 우선 승인 후보로 심사한다. `nv-mistralai`는 NVIDIA/Mistral 공동 제공 별칭으로 같은 우선 그룹에 포함한다.

## 적용 규칙

- 우선 개발사 모델은 동일한 기존 `reviewClass` 안에서 다른 신뢰 개발사 모델보다 먼저 심사한다. 임베딩·가드·파서처럼 기존에 후순위인 비대화형 모델 분류는 유지한다.
- 위 개발사에 대해서는 모델마다 개발사 신뢰도를 다시 평가하는 절차를 승인 판단의 핵심으로 사용하지 않는다. 개발사 정보는 사전 검토된 정책 입력으로 취급한다.
- 실제 모델 승인은 회사 이름만으로 이뤄지지 않는다. 기존과 동일하게 NVIDIA API 실제 호출 성공, Structured Output, 한국어 내부 benchmark 통과가 hard pass 조건이다.
- NVIDIA 제공 경로 및 학생 데이터 사용에 관한 provider 정책 확인은 유지한다. 우선 개발사라도 한국어 benchmark 또는 실제 호출에 실패하면 승인되지 않는다.
- 그 외 개발사의 기존 allowlist/차단 정책과 재심사 로직은 변경하지 않는다.

## 구현

`src/lib/ai/model-auto-approval.ts`에 `PRIORITY_PUBLISHERS`를 추가하고 정책 버전을 `2026-09-17.3-priority-publisher-korean`으로 올렸다. 승인 결과의 `evaluation_profile_json`에 `priorityPublisher`를 기록해 우선 그룹 여부를 확인할 수 있게 했다.

데이터베이스 스키마 변경은 없다.

## 배포 검증

정책 소스 커밋 이후 일반 `main` 커밋을 추가해 CI 및 Vercel 운영 배포가 최신 정책 코드를 포함한 HEAD를 기준으로 다시 실행되도록 했다.
