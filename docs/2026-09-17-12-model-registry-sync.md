# 2026-09-17 공통 승인 모델 12개 동기화

## 변경 내용

시험온의 공통 승인 Registry에 `meta/llama-3.2-90b-vision-instruct`가 한국어 텍스트 기준 통과 모델로 추가되어 수행도우미도 동일한 12개 승인 목록으로 동기화했다.

## 검증 결과

- 시험온 live approved: 12
- 수행도우미 live approved: 12
- 신규 동기화 모델: `meta/llama-3.2-90b-vision-instruct`
- 한국어/Structured Output/Reasoning capability만 공유
- NVIDIA Hosted Vision 호출은 HTTP 500이었으므로 Vision capability는 승인하지 않음
- 기존 수행도우미 역할별 `evaluation_profile_json`은 유지

## 운영 처리

동기화는 Production 빌드 환경의 기존 서버 자격증명으로 일회성 수행했다. 동기화 후 임시 스크립트는 제거했고 `npm run build`는 정상 `next build`로 복구했다.

시험온이 승인 Registry의 Source of Truth이며 수행도우미는 해당 Registry를 그대로 사용한다.
