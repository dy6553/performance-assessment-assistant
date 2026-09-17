# 2026-09-17 공통 Registry 다운로드 전용 모델 제외 정책

수행도우미는 시험온의 공통 NVIDIA 승인 Registry를 동기화해 사용한다.

시험온 자동심사에서 NVIDIA Build 기준 `Free Endpoint`와 `Partner Endpoint`가 모두 사용 불가하고 `Download Available`만 가능한 모델은 Hosted 자동심사 후보에서 제외하도록 변경됐다.

따라서 다운로드/자체호스팅 전용 모델은 수행도우미의 공통 승인 후보에도 들어오지 않는다. 모델 품질이나 한국어 성능 탈락과는 별개이며, 현재 서비스가 사용하는 NVIDIA Hosted API에서 직접 호출할 수 없는 배포 형태이기 때문에 제외한다.

시험온은 공식 가용성 snapshot에 30일 TTL을 적용하므로 NVIDIA가 Hosted endpoint를 다시 제공하면 재검증할 수 있다. 수행도우미의 로컬 task-routing 프로필은 그대로 유지하며, 시험온에서 최종 승인된 모델 목록만 동기화한다.
