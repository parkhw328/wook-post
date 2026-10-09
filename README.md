<p align="center"><img src="assets/branding/wpost-logo.svg" width="360" alt="wPost logo"></p>

# wook-post

`wPost`는 `wook-shell`과 동일한 주황색·차콜 테마를 사용하는 브랜드입니다.
둥근 차콜 타일 위의 대문자 **P**를 앱 아이콘으로 사용합니다.

- 주 강조색: `#DA702C`
- 배경색: `#100F0F`
- 테두리색: `#282726`

현재 저장소에는 브랜드 자산만 준비되어 있으며, 앱 구현과 빌드 구성은 아직 없습니다.

## 브랜드 자산

| 자산 | 용도 |
| --- | --- |
| [P 아이콘](assets/branding/wpost-icon.png) | README, 앱 아이콘 원본 PNG |
| [wPost 로고](assets/branding/wpost-logo.svg) | 투명 배경 가로형 로고 |
| [Windows 아이콘](assets/wpost.ico) | 16–256px 멀티 사이즈 ICO |

디자인 기준과 생성 기록은 [브랜딩 문서](assets/branding/README.md)를 참고하세요.

Windows PowerShell에서 ICO를 다시 생성할 수 있습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/make-icon.ps1
```
