# wPost 브랜딩

## 기준

표기명은 **wPost**이다. `w`는 소문자, `P`는 대문자로 쓴다. wShell과 같은 제품군으로 인식하도록 아이콘·색상·글꼴을 공유한다. 첫 적용 버전은 `0.1.0-alpha.2`이다.

참조 저장소: `/data/project/wook-shell`, 커밋 `970b131099ca3905607cc19ec60106af529adb4c`. 기준 문서는 `assets/branding/README.md`, `rules/product.md`, `rules/workspace-ui.md`이며 색상은 `src/ui.hpp`와 `mac/Sources/WShell/Theme.swift`를 확인했다. 참조 저장소는 변경하지 않는다.

## 시각 자산

- `build/icon.png`: wShell의 `assets/branding/wshell-icon.png` 원본. 주황색 `w`와 차콜 배경을 앱 정보·창 아이콘에 사용한다.
- `build/icon.ico`: wShell의 `assets/wshell.ico` 원본. Windows 실행 파일·설치기·바로가기에 사용한다.
- 헤더는 아이콘 없이 **wPost** 텍스트 워드마크를 사용한다. 시작 화면에는 공통 문구 `LESS FRICTION. MORE FLOW.`를 표시한다.
- `src/renderer/src/assets/fonts/`: 수정하지 않은 JetBrains Mono Regular/Bold. 네트워크 없이 로드하며 한글은 시스템 글꼴로 대체한다.
- 테마 원본은 `src/renderer/src/theme.css`에서 관리한다. 화면별 임의의 강조색을 추가하지 않는다.

| 역할                             | Flexoki Dark 색상                 |
| -------------------------------- | --------------------------------- |
| 배경 / 패널 / 높인 표면          | `#100f0f` / `#1c1b1a` / `#282726` |
| 경계선                           | `#343331`                         |
| 본문 / 밝은 텍스트 / 보조 텍스트 | `#cecdc3` / `#fffcf0` / `#878580` |
| 버튼·선택·포커스                 | `#da702c`                         |

성공·오류·HTTP 메서드·JSON 문법 색상은 의미를 구별하기 위해 별도 토큰을 사용한다. 아이콘과 글꼴의 원본 라이선스 및 출처는 [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)에 보관한다.

## 이름 변경과 호환성

창 제목, 앱 정보, 설치기, 바로가기, 내보내기 기본 파일명에는 `wPost`를 사용한다. 설치 파일은 `wPost-<version>-x64-Setup.exe`이다.

기존 설치와 데이터를 이어 쓰도록 다음 식별자는 유지한다.

- 설치 식별자: `com.parkhw328.wookpost`. 기존 NSIS 설치와 같은 앱으로 업그레이드한다.
- 저장 위치: `<appData>/Wook Post/wook-post.sqlite`. Windows에서는 `%APPDATA%/Wook Post/wook-post.sqlite`이다. 새 이름의 빈 데이터 폴더를 만들지 않는다.
- 백업: `format: "wook-post"`, `schemaVersion: 1`. 이전 버전 백업을 계속 가져올 수 있다.
- 내부 npm 패키지 이름 `wook-post`와 IPC API `window.wook`.

기존 `AGENTS.md`와 요구사항 원문은 변경하지 않는다.
