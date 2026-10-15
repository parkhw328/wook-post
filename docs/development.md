# 개발 안내

[문서 목록](README.md) · [프로젝트 홈](../README.md)

## 시작하기

개발 환경: Node.js **24 LTS 이상**, npm, Git. Windows 빌드 대상은 **x64**입니다.

```bash
npm ci
npm run dev
```

로컬 API를 바로 시험하려면 별도 터미널에서 실행합니다.

```bash
npm run demo:server
```

앱에서 `http://127.0.0.1:4545/echo`를 입력하고 **전송**하세요. 외부 서비스를 사용하지 않고 메서드·헤더·본문을 확인할 수 있습니다. `Ctrl + Enter`는 전송, `Ctrl + S`는 요청 저장입니다.

## Windows 설치 파일 만들기

Windows x64 로컬 터미널에서 실행하세요.

```powershell
npm ci
npm run dist:win
```

타입·포맷·테스트·번들 빌드 후 `release/1.0.0/wPost-1.0.0-x64-Setup.exe`와 SHA-256 체크섬을 생성합니다. 버전별 폴더를 사용해 다른 버전의 빌드를 보존합니다. [릴리스 폴더 안내](../release/README.md)를 참고하세요. NSIS 기반 설치 마법사에서 설치 경로를 선택할 수 있고 바탕화면·시작 메뉴 바로가기를 제공합니다. 상용 InstallShield 프로젝트 파일은 사용하지 않습니다.

현재 Linux 개발 환경에서 Windows 설치 과정은 검증하지 않았습니다. [배포 체크리스트](releasing.md)로 실제 Windows 설치·업그레이드·제거를 확인해야 합니다. 코드 서명은 아직 구성하지 않았습니다.

2026-10-08의 기존 Docker 빌드 정보는 [빌드 기록과 체크섬](builds/v0.2.0-windows.md)에 보관합니다. 이후 브랜딩 변경이 포함된 재빌드는 해당 기록의 체크섬과 다를 수 있으며, 실제 설치 파일 옆의 `.sha256` 파일로 확인합니다. 설치 파일 자체는 Git에 포함하지 않습니다.

## 개발 명령

| 명령                  | 용도                                         |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Electron 개발 실행                           |
| `npm run build`       | 타입 검사와 프로덕션 번들 생성               |
| `npm start`           | 빌드된 데스크톱 앱 실행                      |
| `npm test`            | 통신·저장·변환 테스트                        |
| `npm run test:e2e`    | 실제 Electron 창으로 기능 검증               |
| `npm run check`       | 타입·Prettier·테스트 확인                    |
| `npm run format`      | 소스·문서 포맷 정리                          |
| `npm run dist:win`    | Windows x64 로컬 설치기 빌드                 |
| `npm run icons:build` | SVG에서 PNG·ICO 재생성 (`rsvg-convert` 필요) |

디스플레이 없는 Linux 테스트 환경에서는 `xvfb-run -a npm run test:e2e`를 사용합니다. 루트 컨테이너의 테스트 실행에만 샌드박스 예외를 적용하며 일반 앱 실행 설정에는 적용하지 않습니다.

## 구조와 작업 기록

```text
src/main/       HTTP 통신, SQLite, 파일 변환, Electron 창 및 IPC
src/preload/    화면에 공개하는 제한된 데스크톱 API
src/renderer/   React 화면과 스타일
src/shared/     데이터 타입과 런타임 검증 스키마
tests/          실제 HTTP·저장·파일 변환 및 Electron 테스트
scripts/        설치기·아이콘 빌드와 테스트용 API 서버
build/          wPost 전용 SVG·PNG·ICO 아이콘
licenses/       디자인 참조·테마·번들 글꼴 라이선스
resources/      로컬 참고 자료 (Git 추적 제외)
rules/rules.md  작업 원칙과 진행 기록
docs/           제품 조사와 배포 절차
```

TypeScript strict 모드, 2칸 들여쓰기, Prettier를 사용합니다. 컴포넌트는 PascalCase, 함수·변수는 camelCase, 테스트는 `*.test.ts`와 E2E의 `*.spec.ts`로 작성합니다. 테스트는 외부 API 대신 로컬 서버와 임시 DB를 사용합니다.

[작업 기록](../rules/rules.md) · [변경 이력](../CHANGELOG.md) · [경쟁 제품 조사](benchmark.md) · [버전·배포 절차](releasing.md)

공유 디자인 자산의 출처와 라이선스는 [디자인 자산 고지](../THIRD_PARTY_NOTICES.md)에 기록합니다. 설치된 앱에서도 **앱 정보 → 라이선스 및 오픈소스 고지**로 확인할 수 있습니다.

`0.2.0`의 [기능·호환성 점검 결과](reviews/v0.2.0.md)와 `0.1.0`의 [전체 점검 기록](reviews/v0.1.0.md)을 확인할 수 있습니다.

브랜드 원본과 이미지 생성 기록은 [브랜딩 자산 문서](../assets/branding/README.md)를 참고하세요.
