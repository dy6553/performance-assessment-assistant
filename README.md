# wanhee 수행평가 도우미

한국 초·중·고 수행평가를 위한 교육과정·루브릭 기반 AI 코파일럿입니다.

핵심 흐름은 **과제 요구사항 분석 → 작성 전략 → 초안 → 요구조건/교육과정/논리/사실/출처 검증 → 수정**입니다.

## 기술 스택

- Next.js App Router + TypeScript
- Vercel
- Supabase (Database/Auth/Storage)
- NVIDIA Hosted NIM API
- Zod 구조화 출력 검증

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

필수 서버 환경 변수:

```dotenv
NVIDIA_API_KEY=
NVIDIA_MODEL_FAST=nvidia/nemotron-3-nano-30b-a3b
NVIDIA_MODEL_REASONING=nvidia/nemotron-3-super-120b-a12b
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

비밀 키에는 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

## MVP

1. 학교급·학년·학년도·과목·주제·교사 안내문 입력
2. 요구사항/수행평가 유형/교육과정 추론
3. 작성 전략 생성
4. 초안 생성
5. 요구조건·교육과정·논리·사실/출처·학년 수준·루브릭 검증
6. 검증 근거와 수정 제안 표시

모든 AI 호출은 내부 AI Router를 통과하며 승인된 NVIDIA 모델 allowlist 안에서만 선택합니다.
