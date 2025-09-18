## TechLAB Festival 부스게임

웹으로 실행되는 간단한 부스 게임 모음입니다. 현재 `야바위`, `똥피하기` 두 개의 폴더에 각각 독립적으로 실행 가능한 파일들이 있습니다.

### 폴더 구조
- **`야바위/`**: `index.html`, `styles.css`, `app.js`, `total.md`, `total.pdf`
- **`똥피하기/`**: 동일하게 HTML/CSS/JS 기반 (빈 폴더일 경우 `.gitkeep` 포함)

### 실행 방법 (로컬)
- 방법 1: 파일 더블클릭으로 브라우저에서 `index.html` 열기
- 방법 2: 간단한 로컬 서버 사용 (권장)
```bash
# Python 3가 있을 경우
python -m http.server 5500
# 또는 VS Code Live Server 확장 사용
```
브라우저에서 `http://localhost:5500/야바위/` 또는 `http://localhost:5500/똥피하기/`로 접속합니다.

### 변경사항 푸시 (예: 야바위)
```bash
git status
git add -A "야바위"
git commit -m "야바위: 변경사항 반영"
git push
```
이미 추적 중인 파일만 수정했다면:
```bash
git commit -a -m "야바위: 빠른 수정 커밋"
git push
```

### 초기 설정 요약
- 로컬 저장소 초기화 및 `.gitignore` 추가 완료
- 원격 저장소: [`TechLAB_FESTIVAL`](https://github.com/shyun51/TechLAB_FESTIVAL)
- 기본 브랜치: `main` (원격 `origin/main` 트래킹 설정됨)

### 협업 팁
- 기능 단위 브랜치 권장: `feature/xxx`
```bash
git checkout -b feature/yyy
# 작업 후
git add -A && git commit -m "feat: yyy" && git push -u origin feature/yyy
```

### 문의/개선
이슈나 개선 아이디어는 리포지토리 이슈에 올려 주세요. 문서/코드 정리는 수시로 업데이트됩니다.
# TechLAB_FESTIVAL