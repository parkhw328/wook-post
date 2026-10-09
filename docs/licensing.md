# 라이선스 및 재배포 확인

검토일: 2026-10-09. 대상: wPost 0.2.3의 소스, 직접 사용하는 라이브러리와 Scheduler, 번들 글꼴·디자인 자산, Windows 패키지의 라이선스 파일.

## 프로젝트 라이선스

소유자의 선택에 따라 프로젝트 자체 코드와 권리를 보유한 자산은 MIT로 제공한다. 루트 `LICENSE`와 `package.json`의 `license: MIT`가 기준이다. `private: true`는 npm에 실수로 패키지를 게시하는 것을 방지하는 설정이며, MIT 라이선스 또는 GitHub 공개 저장소 운영과 충돌하지 않는다.

[MIT 공식 원문](https://opensource.org/license/mit)은 사용·수정·재배포·상업적 이용을 허용하며 저작권 및 허가 고지 보존을 요구한다. 제3자 코드를 자체 MIT 저작물로 바꾸는 것은 아니다.

## 포함 구성요소

- React·React DOM·Scheduler·Zod는 설치된 패키지의 MIT 원문을 보존한다.
- [Lucide](https://lucide.dev/license)는 ISC이며 Feather에서 유래한 아이콘의 MIT 고지도 함께 보존한다. 패키지 LICENSE 전체를 복사하므로 두 고지를 모두 포함한다.
- [SIL OFL 1.1](https://openfontlicense.org/open-font-license-official-text/)의 JetBrains Mono와 Noto Sans KR은 수정 없이 앱에 번들한다. 글꼴 파일은 계속 OFL을 따르고, 글꼴 단독 판매 및 수정 글꼴의 Reserved Font Name 조건을 준수해야 한다. 앱 코드까지 OFL로 바꿀 필요는 없다.
- Flexoki와 wShell 디자인 참조의 MIT 저작권·허가 고지를 유지한다.
- Electron 자체는 MIT이지만 Chromium·Node.js·FFmpeg 등 모든 구성요소가 MIT인 것은 아니다. 배포 원본의 `LICENSE.electron.txt`와 `LICENSES.chromium.html`을 유지한다. 원본 코드와 고정된 의존성 정의는 [Electron v44.7.0](https://github.com/electron/electron/tree/v44.7.0)에서 확인할 수 있다. 런타임 수정·재빌드나 별도 구성요소 재배포는 해당 구성요소의 소스 제공 등 추가 조건을 다시 검토한다.

직접 확인한 패키지의 버전과 전체 라이선스 원문은 `licenses/Software-LICENSES.txt`, 글꼴·테마 원문은 `licenses/`에 보관한다. 빌드마다 `npm run licenses:sync`로 소프트웨어 고지를 동기화한다. 새로운 런타임 의존성을 추가하면 스크립트 목록과 `THIRD_PARTY_NOTICES.md`도 갱신한다.

## 아이콘·로고

브라우저 안의 P 아이콘은 wShell 참조 이미지를 바탕으로 OpenAI 이미지 생성 도구로 편집했다. 생성 과정과 프롬프트는 `assets/branding/README.md`에 보존한다. 기존 참조의 MIT 고지는 유지한다.

[OpenAI 이용약관](https://openai.com/policies/terms-of-use/)은 적용 법이 허용하는 범위에서 사용자와 OpenAI 사이의 출력물 권리를 사용자에게 귀속시키지만, 생성물의 독창성·독점성이나 제3자 권리 비침해를 보증하는 것은 아니다. 이름·로고의 상표 충돌이나 모든 코드의 독립적인 출처 검증은 이번 확인 범위에 포함되지 않는다.

## 공개 판단과 배포 파일

확인한 직접 의존성과 디자인 자산에서 공개 또는 상업적 배포 자체를 금지하는 조건은 발견하지 않았다. 해당 조건과 고지를 지키는 공개 배포가 가능한 구성으로 판단하지만, 이를 모든 법적 쟁점에 대한 무조건적인 보증으로 해석해서는 안 된다.

- 설치 패키지의 `resources/LICENSE`, `resources/THIRD_PARTY_NOTICES.md`, `resources/licenses/`를 보존한다.
- 실행 파일 옆의 Electron·Chromium 고지 파일도 보존한다.
- 새 버전 게시 전에 원본 라이선스와 패키지의 파일이 일치하는지 확인한다.

이번 작업은 저장소의 공개/비공개 설정을 변경하지 않는다. GitHub 저장소 공개는 별도의 작업이다.
