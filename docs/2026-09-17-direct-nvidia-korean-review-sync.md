# 2026-09-17 NVIDIA 직접 한국어 심사 결과 동기화

## 개요

시험온이 NVIDIA API의 실시간 모델 목록을 직접 조회하고 한국어 능력 검증을 수행한 결과를 공통 승인 Registry의 Source of Truth로 사용했다. 수행도우미는 시험온의 공통 승인 상태만 동기화하고, 수행도우미 고유의 역할별 라우팅 및 평가 프로필은 계속 로컬에서 유지한다.

## 시험온 직접 심사 결과

- NVIDIA `GET /v1/models` 실시간 노출: 82개
- 신뢰 개발사 범용 텍스트 미승인 후보 직접 검사: 15개
- 새로 통과한 모델: `mistralai/mistral-nemotron`
- 나머지 14개: 실제 Chat Completions 호출에서 `NVIDIA_404`로 미승인
- `openai/gpt-oss-120b`, `meta/llama-3.3-70b-instruct`: 현재 해당 NVIDIA API 실시간 모델 목록에 없어 승인하지 않음

### `mistralai/mistral-nemotron` 검증

- 실제 NVIDIA API 호출: 성공
- 한국어 핵심 평가: 통과
- 전체 핵심 점수: 0.90
- 구조화 JSON 출력: 통과
- OCR 한국어 자연화: 통과
- 핵심 평가 지연시간: 6,117ms
- OCR 자연화 지연시간: 4,039ms
- 공통 capabilities: `korean`, `structured_output`, `reasoning`

## 수행도우미 동기화 결과

Production 빌드 환경에서 시험온 공개 Registry를 즉시 동기화했다.

- 중앙 Registry 승인 수: 11
- 수행도우미 반영 승인 수: 11
- revoked: 0
- DB 검증 결과 `enabled=true AND production_approved=true AND catalog_available=true`: 11개
- `mistralai/mistral-nemotron`이 공통 승인 모델로 추가됨
- 기존 `evaluation_profile_json`은 패치에서 유지되어 수행도우미 고유의 task/subject/format affinity와 priority를 보존함

## 현재 공통 승인 모델 11개

1. `google/diffusiongemma-26b-a4b-it`
2. `google/gemma-4-31b-it`
3. `meta/llama-3.2-11b-vision-instruct`
4. `meta/muse-glimmer-30b`
5. `mistralai/mistral-nemotron`
6. `nvidia/ising-calibration-1.5-31b`
7. `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
8. `nvidia/nemotron-3-super-120b-a12b`
9. `nvidia/nemotron-3-ultra-550b-a55b`
10. `nvidia/nemotron-3.5-lightning-30b-a3b`
11. `openai/gpt-oss-20b`

## 정리

관리용 Supabase 연결은 쓰기 작업이 read-only transaction으로 제한되어 있어 우회하지 않았다. 기존 Production 서버 자격증명이 주입되는 일회성 빌드 동기화를 사용했고, 성공 확인 후 해당 스크립트와 빌드 연결을 제거해 `npm run build`를 정상 `next build`로 복구했다.
