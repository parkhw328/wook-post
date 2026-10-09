# 로컬 릴리스 보관

`npm run dist:win`은 `package.json`의 버전별 폴더에 설치 파일과 SHA-256 체크섬을 생성합니다.

```text
release/
  README.md
  0.2.0/
    wPost-0.2.0-x64-Setup.exe
    wPost-0.2.0-x64-Setup.exe.sha256
  1.0.0/
    wPost-1.0.0-x64-Setup.exe
    wPost-1.0.0-x64-Setup.exe.sha256
```

위 구조는 예시입니다. 빌드한 버전의 폴더만 실제로 생성됩니다.
다른 버전 폴더는 유지하며, 같은 버전을 다시 빌드하면 해당 버전의 산출물을 갱신합니다.
기존 빌드를 별도로 보존하려면 버전을 올린 후 빌드하세요.

설치 파일, blockmap 및 `win-unpacked/` 등 빌드 산출물은 로컬에 보관하고 Git에서는 제외합니다.
이 안내 문서와 빌드 설정만 Git으로 관리합니다.

검증한 설치 파일은 버전 태그를 푸시한 뒤 `npm run release:publish`로 GitHub Releases에 게시합니다.
GitHub에는 최신 정식 릴리스 1개만 제공하며, 이 폴더의 이전 버전들은 그대로 보관합니다.
README의 다운로드 링크는 GitHub의 최신 `wPost-x64-Setup.exe`로 연결됩니다.
