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
- 현재 배포 버전은 `0.2.0`. 2026-10-08 사용자 요청에 따라 prerelease 접미사와 ALPHA 표시를 제거한다. 검증 결과와 미검증 범위는 배포 기록에 구분해 남긴다.
- 기능 추가는 minor, 호환되는 수정은 patch, 호환성 변경은 major를 기준으로 관리한다. 일반 배포에는 prerelease 접미사를 붙이지 않는다.
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

## 2026-10-08 · 0.1.0-alpha.2 wPost 브랜딩

### 요청과 적용 기준

- 사용자 요청에 따라 `/data/project/wook-shell`의 아이콘·이미지·테마를 참조하고 제품 표기를 `wPost`로 변경한다.
- 참조 커밋: `970b131099ca3905607cc19ec60106af529adb4c`. wShell 저장소와 기존 `AGENTS.md`는 변경하지 않는다.
- 원본 주황색 `w` PNG/ICO, Flexoki Dark 색상, JetBrains Mono Regular/Bold를 적용한다. 헤더는 wShell처럼 텍스트 워드마크로 표시한다.
- 색상은 `theme.css`의 공통 토큰으로 관리한다. 강조·선택은 주황색, 성공·실패·문법 색상은 의미별로 구분한다.
- 아이콘·글꼴은 수정하지 않고 복사하며 원본 라이선스를 앱과 저장소에 포함한다. 앱 정보에서 디자인 자산 라이선스를 열람할 수 있다.
- 상세 규칙: [`docs/branding.md`](../docs/branding.md), [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

### 호환성과 버전

- 앱·설치기·바로가기·내보내기 기본 이름을 `wPost`로 통일한다.
- `appId: com.parkhw328.wookpost`, `%APPDATA%/Wook Post/wook-post.sqlite`, 백업 `format: wook-post` / `schemaVersion: 1`은 유지한다.
- 앱 이름 변경으로 빈 저장소가 생기지 않도록 기존 사용자 데이터 경로를 명시적으로 지정한다.
- 버전: `0.1.0-alpha.2`; 작업 브랜치: `feat/v0.1.0-alpha.2-wpost-branding`; 태그: `v0.1.0-alpha.2`.
- 설치 파일: `release/wPost-0.1.0-alpha.2-x64-Setup.exe`. 이전 alpha.1 설치 파일은 별도로 유지한다.

### 검증

- `npm run check` 통과: 타입·포맷 검사와 단위/통합 테스트 24개.
- Xvfb의 실제 Electron UI 시나리오 2개 통과. 요청·응답, 저장, 재시작, 백업, 가져오기, 취소, 인증·환경 변수·바이너리 내보내기 확인.
- Linux alpha.1 패키지에서 컬렉션·환경·요청을 저장하고 실제 로컬 HTTP 응답을 기록했다. 같은 사용자 데이터 위치로 alpha.2를 실행해 워크스페이스와 응답 원본이 동일함을 확인했다.
- alpha.1이 내보낸 JSON을 alpha.2에서 가져와 요청이 추가되고 히스토리는 중복되지 않음을 확인했다.
- 두 글꼴의 실제 로딩, 앱 정보의 아이콘·라이선스 열람, 1000×700 및 1440×940 화면을 확인했다.
- 실제 Windows 설치·업그레이드·삭제는 사용자 검증 범위로 남긴다.
- 로컬 Docker에서 새 Windows x64 NSIS 설치기를 생성했다. 크기는 113,926,145바이트 (108.65 MiB), SHA-256은 `47e952616949179272718c6ab5a6d4eed27188ac807285683216307d33cf00dd`이다.
- 설치 아카이브 무결성, x64 실행 파일, 제작자·버전 메타데이터, 앱과 설치기의 원본 아이콘 7종, 번들 글꼴·라이선스 포함을 확인했다. 코드 서명은 적용하지 않았다.
- 재현 명령과 전체 확인 결과는 [`docs/builds/v0.1.0-alpha.2-windows.md`](../docs/builds/v0.1.0-alpha.2-windows.md)에 기록한다.

## 2026-10-08 · 0.1.0 가독성 개선과 동작 점검

- 사용자 요청: 알파 표시 제거, 영문 JetBrains Mono·한글 본고딕/Noto Sans 계열 적용, 작은 글씨 전반 개선, 주요 동작 전체 점검.
- 버전을 `0.1.0`으로 변경하고 ALPHA 배지·알파 안내를 제거한다. 작업 브랜치는 `feat/v0.1.0-readability`, 태그는 `v0.1.0`이다. 과거 태그·빌드 기록은 유지한다.
- Google Fonts의 Noto Sans KR 가변 글꼴과 OFL 원문을 지정 커밋에서 내려받아 수정 없이 포함했다. 출처와 SHA-256은 `THIRD_PARTY_NOTICES.md`에 기록한다.
- UI 16px, URL·본문·응답 17px, 보조 정보 최소 14px로 통일하고 색 대비·영역 크기·줄바꿈·스크롤을 조정한다. 최소 창에서도 글자를 줄이지 않는다.
- 코드 및 실제 실행 점검에서 응답 복사 권한 오류, JSON 정렬의 숫자·중복 키 손실, 히스토리 연속 더 보기의 중복 행을 재현했다. 각각 수정하고 회귀 테스트를 추가했다.
- 응답 코드 글꼴 상속도 수정했다. 실제 렌더링에서 영문·한글 번들 글꼴을 사용하는지 검사한다.
- 설치 식별자·기존 DB 경로·백업 스키마는 유지한다. 자세한 근거와 판단은 [`docs/reviews/v0.1.0.md`](../docs/reviews/v0.1.0.md)에 남긴다.
- 검증 완료: 타입·포맷 검사, 단위·통합 테스트 28개, 실제 Electron UI 시나리오 5개 통과. 1440×940 및 1000×700 화면을 점검하고 스크린샷을 갱신했다.
- 로컬 Docker에서 `release/wPost-0.1.0-x64-Setup.exe` 생성. 118,243,588바이트 (112.77 MiB), SHA-256 `215d9fb50c5da2d209e6ef6fba289f7fc41b253bdb69e56e31ff488d4c6d4078`.
- 설치 아카이브, x64 실행 파일, `0.1.0` 메타데이터, 번들 TTF 3개 및 라이선스 4개 포함 확인. Windows 실제 설치·배율별 확인과 코드 서명은 별도 확인 범위로 기록했다.
- 설치 파일·재현 명령: [`docs/builds/v0.1.0-windows.md`](../docs/builds/v0.1.0-windows.md). 소스·기록을 기능 브랜치와 버전 태그로 관리하며 설치 파일은 Git에 추가하지 않는다.

## 2026-10-08 · 0.2.0 아이콘 구분·컬렉션 관리·화면 설정

- 사용자 요청: 작업표시줄에서 wShell과 아이콘 구분, 컬렉션 이름 변경·삭제, 전체 글꼴·글자 크기 설정.
- wPost 전용 파란색 P 벡터 아이콘을 제작하고 PNG와 ICO 7개 크기(16–256px)를 생성했다. 소스는 `build/icon.svg`, 재생성은 `npm run icons:build`이다. wShell 저장소와 기존 `AGENTS.md`는 변경하지 않는다.
- 컬렉션 옆 연필·휴지통 버튼과 삭제 확인창을 추가했다. 기본 삭제는 요청을 미분류로 옮기며, 명시적으로 선택하면 요청도 함께 삭제한다. 히스토리와 열린 편집 내용은 보존한다.
- 왼쪽 아래 앱 설정에서 영문 4종·한글 3종 선택, 전체 글자 크기 80–150%, 즉시 미리보기, 취소·기본값 복원을 제공한다. 기본 글꼴은 JetBrains Mono·Noto Sans KR, 기본 크기는 기존 100%이다.
- 화면 설정은 기존 SQLite의 별도 `appearance` 테이블에 저장한다. 기존 데이터 경로, 설치 식별자, SQLite `user_version: 1` 및 백업 스키마 v1을 유지하며 백업에 PC별 화면 설정은 포함하지 않는다.
- 설정창의 저장·취소 버튼은 확대 시에도 고정하고 본문만 스크롤되도록 조정했다.
- 버전 `0.2.0`, 작업 브랜치 `feat/v0.2.0-collections-appearance`, 태그 `v0.2.0`으로 관리한다.
- 최종 검증: TypeScript·Prettier·단위/통합 테스트 35개, 실제 Electron 시나리오 8개 통과. 1000×700 창과 150% 글자 크기에서 전송·설정 저장을 확인하고 화면 기록을 갱신했다.
- 로컬 Docker에서 `release/wPost-0.2.0-x64-Setup.exe` 생성. 116,631,938바이트 / 111.23 MiB, SHA-256 `c82b09e73558e5ce3abbcc9e0a3efd783c9e55c4cfae6593b945e6ad9b54f2d3`.
- NSIS 아카이브, x64 앱, 버전·제작자, 앱·설치기의 새로운 아이콘 리소스 7종, 번들 글꼴·라이선스를 확인했다. Windows 실제 설치·작업표시줄 표시와 코드 서명은 별도 확인 범위다.
- [기능 점검](../docs/reviews/v0.2.0.md)과 [설치기 빌드 기록](../docs/builds/v0.2.0-windows.md)에 재현 명령·확인 범위를 정리한다. 설치 파일은 `release/`에 보관하며 Git에는 소스·문서·화면 기록만 추가한다.
- 릴리스 커밋 메시지: `feat: add wPost v0.2.0 collection and appearance settings`. 브랜치와 `v0.2.0` 태그를 함께 원격에 반영하며 이전 태그는 이동하지 않는다.
