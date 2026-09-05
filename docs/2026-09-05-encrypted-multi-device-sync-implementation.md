# 암호화 멀티기기 동기화 구현 기록

- 구현일: 2026-09-05
- 대상: 수행도우미
- 구현 커밋: 최종 배포 커밋의 직전 구현 커밋(아래 배포 기록에서 갱신)

## 변경 파일

- `src/lib/sync/*`: AES-256-GCM, RSA-OAEP 키 봉투, persistent queue, pull/push, 충돌 감지
- `src/app/api/sync/route.ts`: 로그인 세션을 사용하는 최소권한 RPC 중계
- `src/components/encrypted-sync-runtime.tsx`: 자동 트리거와 상태 UI
- `src/components/device-sync-settings.tsx`: 내 기기, 마지막 접속/동기화, 원격 해제
- `src/lib/local-data/db.ts`: queue/state/conflict/crypto IndexedDB store 및 변경 이벤트
- `supabase/migrations/20260905090000_add_encrypted_device_sync.sql`
- `tests/encrypted-sync.test.mjs`

## DB 및 Storage

`user_devices`, `device_key_envelopes`, `encrypted_sync_records`, `encrypted_sync_files`와 pull 인덱스·tombstone 인덱스를 추가했다. 모든 테이블은 RLS를 켜고 직접 접근 권한을 제거했다. 인증 사용자에게는 현재 기기의 활성/해제 상태를 검사하는 제한 RPC만 허용한다. 비공개 `encrypted-sync-files` bucket은 100MiB 한도와 계정 경로 정책을 사용한다.

## 암호화와 키 관리

민감한 payload는 브라우저 Web Crypto의 AES-256-GCM으로 암호화하며 레코드마다 96비트 무작위 IV와 AAD(`record_id|version|schema`)를 사용한다. 계정 동기화 키는 각 기기의 RSA-OAEP-3072/SHA-256 공개키로 감싼 봉투만 서버에 저장한다. 원본 AES 키와 RSA 개인키는 IndexedDB의 기기 저장소에만 존재한다. 새 기기는 기존 활성 기기가 봉투를 전달하기 전까지 복호화를 시작하지 않는다.

## 동기화·충돌·삭제

로컬 저장이 먼저 완료된 뒤 persistent queue에 등록한다. 1.5초 debounce, 실행/로그인, 탭 복귀, online, 60초 재시도, 수동 버튼이 flush를 시작한다. 서로 다른 record는 독립 병합한다. 동일 record의 `baseVersion`이 서버 버전과 다르고 hash가 다르면 충돌 store에 양쪽 암호문을 보존하며 silent overwrite하지 않는다. 삭제는 암호화 payload와 `deleted_at` tombstone을 같은 버전 규칙으로 전파한다.

## 동기화 대상

IndexedDB의 수행평가 프로젝트·주제·조사·초안·완성본, AI 대화, 캘린더, 첨부파일 메타데이터와 설정 store를 record 단위로 동기화한다. 기존 `.assessment-backup` export/import는 변경하지 않았다.

## 테스트 결과

- TypeScript strict: 통과
- 기존 단위 테스트: 통과
- Production build: 통과
- AES round-trip/고유 IV/변조 거부/RSA 키 전달: 통과
- Supabase migration: 두 대상 프로젝트 적용 성공

## 알려진 제한사항

- 실제 사용자 계정 두 개/실기기 두 대의 브라우저 자동화는 테스트 계정 자격 증명이 없어 로컬 테스트에서 재현하지 못했다.
- OPFS 원본 파일용 테이블과 Storage 정책은 적용했지만 이번 클라이언트 구현은 첨부파일 메타데이터 동기화까지만 연결되어 있다. 원본 바이너리 업로드/다운로드 연결은 후속 검증이 필요하다.

## Production 배포

Vercel Git 연동 production 배포의 최종 상태와 URL은 배포 확인 후 이 문서 후속 커밋에 기록한다.
