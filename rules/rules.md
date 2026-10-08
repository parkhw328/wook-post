# Wook Post 작업 기록

## 프로젝트 원칙

- 요구사항 원본: [`resources/setting.txt`](../resources/setting.txt).
- Windows x64 설치형 API 클라이언트. Windows 로컬 빌드를 기본으로 제공하며, 사용자 요청에 따라 개발 환경의 로컬 Docker에서도 설치 파일을 생성한다.
- 제작자: **Hyunwook Park (parkhw328@gmail.com)**.
- 한국어 UI, 빠른 요청 작성, 명확한 결과 확인, 로컬 데이터 보관을 우선한다.
- 컬렉션·히스토리·응답을 버전이 있는 JSON으로 가져오고 내보낸다.
- 작업마다 이 문서와 `CHANGELOG.md`에 변경·검증·남은 일을 기록한다.
- 기능과 성능은 실제 구현·측정 결과로 설명한다. 경쟁 제품보다 빠르다는 주장은 비교 측정 후에만 사용한다.

## 버전 및 Git 운영

- `package.json`을 앱 버전의 기준으로 삼고 `package-lock.json`을 함께 관리한다.
- 초기 검증판은 `0.1.0-alpha.1`. Windows 설치 검증 전까지 알파로 명시한다.
- 기능 추가는 minor, 호환되는 수정은 patch, 호환성 변경은 major를 기준으로 관리한다. 알파 검증 중에는 prerelease 번호를 올린다.
- 백업의 `schemaVersion`과 SQLite의 `user_version`은 앱 버전과 별개로 관리한다. 현재 둘 다 `1`이다.
- 변경은 기능 브랜치에서 검증 후 커밋한다. 메시지 예: `feat: add local API client v0.1.0-alpha.1`.
- 푸시한 브랜치, 커밋, 버전 태그와 검증 결과를 기록한다. 원격 main을 강제로 덮어쓰지 않는다.
- 버전 변경 절차와 Windows 확인 항목은 [`docs/releasing.md`](../docs/releasing.md)에 둔다.

## 2026-10-08 · 0.1.0-alpha.1 구현

### 조사 및 결정

- Postman, Bruno, Hoppscotch, Insomnia의 공식 자료를 확인했다. 근거와 반영 항목은 [`docs/benchmark.md`](../docs/benchmark.md)에 기록한다.
- Electron + React + TypeScript, 메인 프로세스의 Node HTTP 통신, 내장 SQLite를 선택했다.
- 설치기는 NSIS의 단계별 설치 마법사로 구성했다. 상용 InstallShield 프로젝트 형식은 아니다.
- 클라우드 계정·자동 업로드 없이 지정한 API 서버로 요청을 보낸다.
- 히스토리는 자동 삭제하지 않는다. 목록은 100건씩 읽고 본문은 선택할 때 불러온다.

### 구현 내용

- 요청 탭, HTTP 메서드, 쿼리·헤더, JSON·텍스트·폼 본문, Bearer·Basic 인증.
- 환경 변수, 컬렉션에 요청 저장, 검색, 전송·취소, 타임아웃, 리다이렉트 설정.
- 응답 상태·시간·크기·본문·헤더 보기, JSON 정렬, 원본 바이트 저장.
- SQLite 영속 저장, 히스토리 재열기, 전체 백업·히스토리·응답 JSON 가져오기/내보내기.
- 가져오기 미리보기, 기존 데이터에 추가, 트랜잭션 롤백, 동일 기록 중복 방지.
- Postman Collection v2.0/v2.1 가져오기 및 v2.1 내보내기. 지원하지 않는 인증·본문은 오류로 알린다.
- Windows x64 설치기 설정, 로컬 빌드 스크립트, 제작자 정보, 로컬 테스트 서버.

### 검증 진행

- 타입 검사와 프로덕션 번들 빌드 통과.
- 통신·SQLite·가져오기/내보내기 테스트 **24개 통과**.
- Electron 실제 UI 시나리오 **2개 통과**: 요청→저장→백업→가져오기→재실행→재전송→취소→바이너리 저장, 환경 변수→JSON→Bearer 인증→단축키→미저장 종료 보호.
- `npm run check` 통과: TypeScript strict 검사, Prettier, 단위·통합 테스트.
- `electron-builder --linux --dir --publish never`로 실행 패키지 생성 후 패키징된 앱의 실행·HTTP 200 수신·히스토리 저장 확인.
- 화면 JavaScript 번들 265.50 kB, CSS 21.59 kB. 번들 파일 크기이며 실행 메모리·경쟁 제품 대비 성능 수치는 아니다.
- 실행 의존성 `npm audit --omit=dev` 0건. 빌드 도구 경고는 `docs/releasing.md`에 기록.
- 현재 Linux 환경에서는 Windows 설치·업그레이드·삭제를 직접 검증할 수 없다.

### 버전 식별

- 기능 브랜치: `feat/v0.1.0-alpha.1`
- 버전 태그: `v0.1.0-alpha.1`
- 구현 커밋 메시지: `feat: add Wook Post desktop client v0.1.0-alpha.1`
- 원본 요구사항과 기존 `AGENTS.md`는 내용을 변경하지 않고 버전에 포함한다.

### 다음 버전 후보

- Windows 실제 설치 검증, 앱 서명, 설치 용량·시작 시간·메모리 측정.
- multipart 파일 업로드, cURL/OpenAPI 가져오기, 프록시·인증서 설정.
- 쿠키 관리, OAuth 2.0, 테스트 스크립트, 컬렉션 실행기.
- 민감 값 암호화, 대용량 백업 스트리밍, 응답 비교.

이 목록은 후속 후보이며 이번 버전의 완료 기능으로 간주하지 않는다.

## 2026-10-08 · Windows 설치 파일 생성

- 사용자 요청: 설치 파일을 생성하고, 실제 Windows 검증은 사용자가 진행한다.
- 앱 코드와 버전은 `0.1.0-alpha.1` / 소스 커밋 `1d80829`로 유지했다. 기존 버전 태그를 이동하지 않는다.
- 로컬 Docker의 공식 `electronuserland/builder` 이미지와 Wine 11.0으로 NSIS 설치 파일을 생성했다. 소스는 읽기 전용으로 연결하고 `release/`만 출력 경로로 허용했다.
- 결과: `release/WookPost-0.1.0-alpha.1-x64-Setup.exe` · 112,177,134바이트 (106.98 MiB).
- SHA-256: `75e59a41426238917342cb4724f940685d33b952235a3aa52b4ab79615f12c80`.
- 타입 검사·프로덕션 번들 빌드 통과. 7-Zip 설치 아카이브 검사 통과. 내부 앱의 x64 PE 형식, ASAR 필수 파일, 제작자·버전 메타데이터 확인.
- 실제 Windows 설치·실행·제거는 아직 검증하지 않았다. 앱과 설치 파일 모두 코드 서명은 없다.
- 자세한 환경·재현 명령은 [`docs/builds/v0.1.0-alpha.1-windows.md`](../docs/builds/v0.1.0-alpha.1-windows.md)에 기록한다. 설치 파일과 체크섬 파일은 `release/`에 보관하고 빌드 기록만 Git에 추가한다.
