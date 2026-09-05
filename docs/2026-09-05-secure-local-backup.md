# 수행도우미 로컬 데이터 암호화 백업 보완

## 목적

수행평가 프로젝트와 업로드 원본을 기기 로컬 저장소에 두는 Local-first 구조에서 브라우저 데이터 초기화, PWA 삭제, 기기 교체·분실로 인한 자료 손실 위험을 줄인다.

## 적용 내용

- `설정 > 백업 및 복원`의 기본 백업 방식을 암호화 백업으로 변경했다.
- 수행평가 프로젝트, 초안, 완성본, AI 대화, 캘린더, IndexedDB/OPFS 업로드 원본을 기존 전체 백업 구조를 이용해 하나의 파일로 내보낸다.
- Web Crypto API의 AES-256-GCM을 사용한다.
- 암호화 키는 사용자가 입력한 백업 암호에서 PBKDF2-HMAC-SHA-256, 600,000회 반복으로 파생한다.
- 매 백업마다 16바이트 무작위 salt와 12바이트 무작위 IV를 새로 생성한다.
- 백업 암호는 localStorage, IndexedDB, Supabase 또는 서버 로그에 저장하지 않는다.
- 암호화 백업 안에 로그인 계정 식별자의 SHA-256 해시를 포함하고 복원 시 현재 계정과 일치하는지 검증한다.
- 암호가 다르거나 파일이 손상·변조되면 AES-GCM 인증 검증에서 복원을 중단한다.
- 복원은 현재 계정의 기존 로컬 자료와 병합한다.
- 백업 데이터 최대 크기는 기존 정책과 동일하게 250MB로 제한한다.

## 선택형 호환 모드

- 암호화는 기본값이며 권장 경로다.
- 사용자가 명시적으로 암호화를 해제하면 이전 호환용 평문 JSON으로 내보낼 수 있다.
- 평문 내보내기 전 개인정보가 그대로 포함된다는 확인 경고를 표시한다.
- 이전에 만든 `teston-local-backup` JSON 파일은 계속 복원할 수 있다.

## 파일 형식

- 암호화 확장자: `.assessment-backup`
- 바이너리 헤더 + 암호화 메타데이터 + AES-GCM ciphertext 구조다.
- salt/IV만 헤더에 기록하고 수행평가 본문·대화·파일 내용은 암호문 영역에만 존재한다.

## 빌드 호환성 수정

- Vercel의 TypeScript 5.9 엄격 검사에서 Web Crypto PBKDF2의 `salt`가 `BufferSource` 타입과 충돌하는 문제를 확인했다.
- salt를 명시적인 `ArrayBuffer`로 변환해 Web Crypto API에 전달하도록 수정했다.
- 수정 후 production deployment의 Next.js 빌드와 TypeScript 검사가 성공하는 것을 확인했다.

## 검증 결과

- 잘못된 암호 또는 변조 파일은 AES-GCM 인증 검증에서 복원을 거부하도록 구현했다.
- 다른 로그인 계정의 암호화 백업은 계정 해시 검증에서 복원을 거부하도록 구현했다.
- 기존 `buildLocalBackup`/`restoreLocalBackup` 경로를 재사용하여 IndexedDB 및 OPFS 파일을 전체 백업에 포함했다.
- 이전 평문 JSON 백업 복원 호환성을 유지했다.
- Vercel production deployment가 READY 상태가 되는 것을 확인했다.
