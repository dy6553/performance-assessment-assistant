# 교육과정·출판사·교과서 반영 기능

- 적용일: 2026-09-07
- 대상: 수행도우미 (`dy6553/performance-assessment-assistant`)

## 목적

수행평가 결과물이 사용자가 실제로 배우는 교육과정, 출판사, 교과서, 단원 범위에 맞도록 하고, 분석부터 최종 수정까지 동일한 교과서 기준이 유지되게 한다.

## 구현 내용

### 1. 내 교과서 설정

`/settings/textbooks`에서 과목별 교과서 프로필을 등록할 수 있다.

저장 항목:

- 교육과정
- 학교급
- 학년
- 과목
- 세부 과목
- 출판사
- 교과서명
- 단원
- 쪽수

프로필은 기기 `localStorage`에 저장한다. 서버 요청이 현재 선택 기준을 읽을 수 있도록 최소 메타데이터를 압축한 쿠키도 사용한다. 교과서 원문 파일을 이 기능 때문에 별도 중앙 DB에 적재하지 않는다.

### 2. 수행평가 전 단계 연결

등록된 프로필은 같은 교육과정·학교급·학년·과목 요청에 자동 적용한다.

연결 단계:

1. 과제 분석
2. AI 주제 추천
3. 자료 조사·출처 검증
4. 수행 설계·목차 생성
5. 초안 생성
6. 초안 검증
7. 사용자 요청에 따른 초안 수정

과제 흐름에서는 프로필 컨텍스트를 기존 `requiredElements`에 안전하게 합치고, 주제 추천에서는 `additionalConditions`에 합친다. 입력 길이가 한계에 가까워도 교과서 컨텍스트 자체가 잘려 없어지지 않도록 기존 사용자 입력 길이를 먼저 조정한다.

### 3. 교과서 원문과 메타데이터 구분

AI에는 다음 규칙을 명시한다.

- 출판사명과 교과서명은 교과서 원문이 아니다.
- 보지 못한 본문, 예제, 활동, 문장, 수치, 쪽별 내용을 만들어내지 않는다.
- 사용자가 과제 입력이나 첨부 자료로 실제 교과서 페이지·발췌·사진/PDF 분석 내용을 제공하면 그 자료를 우선 근거로 사용한다.
- 지정 단원·쪽수와 교육과정 범위를 벗어나지 않도록 한다.
- 실제 교과서 본문이 제공되지 않았다면 교육과정·교과서 메타데이터는 범위 확인용으로만 사용한다.
- 교과서 원문을 직접 확인하지 않았는데 확인했다고 표현하지 않는다.

### 4. 진로 연계와 우선순위

교과서 컨텍스트를 먼저 과제 입력에 결합한 뒤 기존 진로 연계 컨텍스트를 적용한다. 따라서 진로 연계가 켜져 있어도 교과 적합성, 교육과정, 교사 안내와 루브릭이 우선되고 교과서 범위가 유지된다.

## 저장·DB 결정

이번 변경은 Supabase 마이그레이션이 필요하지 않다.

- 교과서 프로필: 기기 로컬 저장 + 요청용 최소 쿠키 메타데이터
- 실제 교과서 자료: 기존 과제 자료 입력 흐름을 사용
- 신규 교과서 원문 중앙 저장소: 만들지 않음
- 기존 결과/작업 저장 구조: 유지

이는 기존 로컬 우선 저장 정책과 불필요한 저작권 자료 서버 장기 보관 방지를 유지하기 위한 결정이다.

## 변경 파일

- `src/features/assessment/textbook-profile.ts`
- `src/features/assessment/textbook-profile-settings.tsx`
- `src/app/settings/textbooks/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/api/assignment/analyze/route.ts`
- `src/app/api/assignment/recommend-topic/route.ts`
- `src/app/api/assignment/research/route.ts`
- `src/app/api/assignment/plan/route.ts`
- `src/app/api/assignment/generate/route.ts`
- `src/app/api/assignment/verify/route.ts`
- `src/app/api/assignment/revise-draft/route.ts`

## 배포 검증

최종 Vercel 프로덕션 배포 상태와 화면 확인 결과는 배포 검증 후 이 문서에 추가한다.
