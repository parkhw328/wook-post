# wPost 브랜딩

## 기준

표기명은 **wPost**이다. `w`는 소문자, `P`는 대문자로 쓴다. wShell과 Flexoki Dark 테마·기본 글꼴을 공유하되, 주황색 브라우저 창 안에 P를 배치해 제품군의 일관성과 웹/API 도구의 식별을 함께 유지한다. 현재 버전은 프리릴리즈 접미사가 없는 `0.2.3`이다. 앱 화면과 설치기에 ALPHA 배지를 표시하지 않는다.

참조 저장소: `/data/project/wook-shell`, 커밋 `970b131099ca3905607cc19ec60106af529adb4c`. 기준 문서는 `assets/branding/README.md`, `rules/product.md`, `rules/workspace-ui.md`이며 색상은 `src/ui.hpp`와 `mac/Sources/WShell/Theme.swift`를 확인했다. 참조 저장소는 변경하지 않는다.

## 시각 자산

- `assets/branding/wpost-icon.png`: 주황색 `#DA702C` P와 차콜 `#100F0F` 브라우저 창의 이미지 원본. 생성 기록은 [브랜딩 자산 문서](../assets/branding/README.md)에 보관한다.
- `build/icon.svg`: 같은 PNG 원본을 내장한 SVG 래퍼. 기존 아이콘 빌드 경로와 호환된다.
- `assets/branding/wpost-logo.svg`: README용 가로형 로고.
- `build/icon.png`: 주황색 P 앱 아이콘 (재생성 시 512px). 앱 정보·창 아이콘에 사용한다.
- `build/icon.ico`: 동일 SVG에서 렌더링한 16·24·32·48·64·128·256px 이미지. Windows 실행 파일·설치기·바로가기에 사용한다.
- `npm run icons:build`로 PNG/ICO를 재생성한다. 이 선택 명령에만 librsvg의 `rsvg-convert`가 필요하다. 일반 앱 빌드에는 저장소의 완성된 PNG/ICO를 사용한다.
- 헤더는 아이콘 없이 **wPost** 텍스트 워드마크를 사용한다. 시작 화면에는 공통 문구 `LESS FRICTION. MORE FLOW.`를 표시한다.
- `src/renderer/src/assets/fonts/`: 수정하지 않은 JetBrains Mono Regular/Bold와 Noto Sans KR 가변 글꼴. 기본 영문은 JetBrains Mono, 한글은 Noto Sans KR로 표시한다. 모두 앱에 포함하고 외부 다운로드 없이 로드한다.
- 테마 원본은 `src/renderer/src/theme.css`에서 관리한다. 화면별 임의의 강조색을 추가하지 않는다.

| 역할                             | Flexoki Dark 색상                 |
| -------------------------------- | --------------------------------- |
| 배경 / 패널 / 높인 표면          | `#100f0f` / `#1c1b1a` / `#282726` |
| 경계선                           | `#343331`                         |
| 본문 / 밝은 텍스트 / 보조 텍스트 | `#cecdc3` / `#fffcf0` / `#a5a39b` |
| 버튼·선택·포커스                 | `#da702c`                         |

성공·오류·HTTP 메서드·JSON 문법 색상은 의미를 구별하기 위해 별도 토큰을 사용한다. 참조 디자인·테마·글꼴의 라이선스 및 출처는 [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)에 보관한다.

## 글자 크기와 배치

`theme.css`의 `--content-scale`은 요청 URL·본문·입력 값과 응답 본문·헤더의 글씨에만 적용한다. 메뉴·버튼·사이드바·설정 창 크기는 고정한다. 앱 설정의 슬라이더와 −/+ 버튼으로 80–150%를 5% 단위로 조절하며, 기본 100%에서 본문은 17px이다. 글자를 줄여 공간을 확보하지 말고 영역의 너비·높이·줄바꿈·스크롤을 조정한다.

| 용도                           | 기본 크기   |
| ------------------------------ | ----------- |
| 메뉴·버튼·입력·일반 본문       | 16px        |
| URL·요청 본문·응답 코드와 헤더 | 17px        |
| 보조 설명·상태·배지·단축키     | 14px        |
| 섹션 / 주요 제목               | 20px / 28px |

한글 가변 글꼴의 굵기는 CSS에 따라 적용한다. 기본 400, 강조 700을 사용한다. 좁은 창에서도 본문 크기는 유지하며 주요 제목만 24px로 조정한다. 보조 텍스트는 원래 Flexoki 색상보다 밝게 조정해 대비를 높였다. `code` 요소에도 공통 글꼴을 상속한다.

앱 설정에서 영문 JetBrains Mono·Consolas·Cascadia Code·Arial과 한글 Noto Sans KR·맑은 고딕·돋움을 독립적으로 선택한다. PC에 없는 글꼴은 번들 기본 글꼴로 대체한다. 설정은 미리보기 후 저장하며 취소·Esc는 이전 설정을 복원한다.

최소 창 1000×700 및 기본 창 1440×940에서 요청 편집, 응답, 환경 설정, 앱 정보 화면을 점검한다. 최대 글자 크기에서도 설정 저장·취소 버튼이 보이도록 본문에 별도 스크롤을 둔다.

## 이름 변경과 호환성

창 제목, 앱 정보, 설치기, 바로가기, 내보내기 기본 파일명에는 `wPost`를 사용한다. 설치 파일은 `wPost-<version>-x64-Setup.exe`이다.

기존 설치와 데이터를 이어 쓰도록 다음 식별자는 유지한다.

- 설치 식별자: `com.parkhw328.wookpost`. 기존 NSIS 설치와 같은 앱으로 업그레이드한다.
- 저장 위치: `<appData>/Wook Post/wook-post.sqlite`. Windows에서는 `%APPDATA%/Wook Post/wook-post.sqlite`이다. 새 이름의 빈 데이터 폴더를 만들지 않는다.
- 백업: `format: "wook-post"`, `schemaVersion: 1`. 이전 버전 백업을 계속 가져올 수 있다.
- 화면 설정은 기존 DB의 별도 `appearance` 테이블에 저장한다. 이전 버전 DB에 테이블만 추가하고 요청·환경·히스토리는 그대로 둔다. 백업에는 PC별 화면 설정을 포함하지 않는다.
- 내부 npm 패키지 이름 `wook-post`와 IPC API `window.wook`.

기존 `AGENTS.md`와 요구사항 원문은 변경하지 않는다.
