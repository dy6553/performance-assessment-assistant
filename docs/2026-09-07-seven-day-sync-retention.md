# 활성 기기 수신확인 기반 7일 서버 보관 정책

- 구현일: 2026-09-07
- 목적: 암호화 동기화 자료를 모든 활성 기기가 로컬 저장한 뒤 7일 동안만 서버의 임시 전달·복구 사본으로 보관합니다.
- 변경: `sync_delivery_receipts`, `server_expires_at`, `sync_ack_items`, 시간별 pg_cron, `encrypted-sync-retention` Edge Function
- 동작: 활성 기기 전체가 동일 버전을 수신 확인하면 만료일이 7일 뒤로 설정됩니다. 미수신 기기·충돌·새 활성 기기가 있으면 삭제가 보류됩니다.
- 파일: Storage 객체를 Storage API로 먼저 삭제한 경우에만 파일 메타데이터를 제거합니다.
- 보안: RLS로 계정별 영수증을 격리하며, 정리 후보/확정 RPC는 service_role 전용입니다. service_role 키는 클라이언트에 노출하지 않습니다.
- 적용: 시험온 `jqbbsdoivsulehxmrkjl`, 수행도우미 `whdgkzxnjdcudypyvmau`에 Production migration과 Edge Function을 적용했습니다.
- 제한: 기기 OS가 앱 저장공간을 지우면 그 기기의 로컬 사본도 사라집니다. 서버 만료 후 새 기기는 만료된 과거 자료를 복원할 수 없습니다.
