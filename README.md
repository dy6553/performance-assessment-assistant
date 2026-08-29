# 수행평가 도우미

한국 초·중·고 수행평가의 요구사항과 평가표를 분석해 작성 전략, 초안, 독립 검증, 수정본까지 만드는 PWA입니다.

## 주요 기능

- 학교급·학년·학년도·과목·주제·교사 안내문 입력
- 평가표 PDF 업로드 및 고화질 이미지 변환 OCR(최대 6페이지, 4MB)
- 수행평가 유형과 적용 교육과정 추론
- 평가기준별 작성 전략과 감점 위험 생성
- 수행평가 초안 생성
- 요구조건·교육과정·루브릭·논리·사실/출처·형식·학년 수준 검증
- 검증 결과를 반영한 수정본과 복사 피드백
- 라이트·다크 모드, 갤럭시/삼성 인터넷 PWA 설치
- NVIDIA 장애 시 승인된 대체 모델로 자동 전환

## 기술 구성

- Next.js 16 App Router, React 19, TypeScript
- Vercel 웹·서버 배포
- NVIDIA Hosted NIM API
- Supabase `model_registry` 기반 승인 모델 라우팅
- Zod 구조화 출력 검증
- PDF.js, Canvas, Sharp 기반 서버 PDF 렌더링·선명화

현재 사용자 로그인이나 과제 영구 저장은 UI에 연결되어 있지 않습니다. 입력 내용과 PDF는 AI 처리를 위해 서버와 NVIDIA API로 전송되지만 앱 데이터베이스에는 저장하지 않습니다. `supabase/migrations`에는 향후 사용자별 저장 기능을 위한 스키마가 포함되어 있습니다.

## 로컬 실행

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

macOS/Linux에서는 `cp .env.example .env.local`을 사용합니다.

환경변수의 역할은 [.env.example](.env.example)에 정리되어 있습니다. `SUPABASE_SECRET_KEY`, `NVIDIA_API_KEY`, `CRON_SECRET`는 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이면 안 됩니다.

## AI Router

Router는 Supabase `model_registry`에서 production 승인을 받은 NVIDIA 모델을 읽고 다음 조건을 모두 통과한 모델만 사용합니다.

- 승인 Provider·Model
- 중국계 모델 제외
- 학생 데이터 정책과 개인정보·보안 검토 통과
- API 입력 학습 미사용 확인
- `korean`, `structured_output` capability 충족
- `production_approved = true`
- NVIDIA 실시간 모델 카탈로그에서 사용 가능

AI 요청 시 NVIDIA 모델 카탈로그를 최대 1시간 캐시로 확인합니다. Vercel Cron은 하루 1회 `/api/internal/model-catalog/sync`를 호출합니다. 새 후보는 비활성·미승인 상태로만 등록되며 검토 전에는 사용되지 않습니다.

## 확인 명령

```bash
npm run check
npm run build
npm audit --omit=dev
```
