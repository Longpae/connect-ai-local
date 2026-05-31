# Connect AI (Local)

VS Code / Cursor / Windsurf 용 **100% 로컬 AI 채팅** 확장 프로그램.  
외부 서버 연결 없이 [Ollama](https://ollama.com)로 구동되며, SQLite DB를 채팅에서 바로 조회할 수 있습니다.

## 기능

| 기능 | 설명 |
|------|------|
| 💬 AI 채팅 | Ollama 모델과 스트리밍 대화 |
| 🗄️ DB 조회 | SQLite DB에 SQL 직접 실행 후 테이블로 표시 |
| ⚡ 빠른 활성화 | 필요할 때만 로드 (시작 속도에 영향 없음) |
| 🔒 완전 오프라인 | 외부 API 호출 없음 |

## 설치

### 1. Ollama 설치 및 모델 다운로드

```bash
# https://ollama.com 에서 설치 후
ollama pull llama3
ollama serve
```

### 2. 확장 설치

**릴리즈 페이지**에서 `.vsix` 파일을 다운로드한 뒤:

```bash
code --install-extension connect-ai-local-0.1.0.vsix
```

또는 VS Code → Extensions → `···` → *Install from VSIX…*

## 사용법

| 단축키 / 명령 | 동작 |
|--------------|------|
| `Ctrl+Shift+A` | 채팅 패널 열기 |
| `Connect AI: DB 조회` | SQL 입력 후 결과 표시 |

채팅 패널 하단의 SQL 입력창에 쿼리를 입력하고 **DB 조회** 버튼을 눌러도 됩니다.

### DB 조회 예시

```sql
-- 전체 테이블 목록
SELECT name FROM sqlite_master WHERE type='table';

-- 최근 고객 20명
SELECT * FROM 고객 ORDER BY 등록일 DESC LIMIT 20;

-- 이름으로 검색
SELECT * FROM 고객 WHERE 이름 LIKE '%김%';
```

## 설정

```jsonc
{
  "connectAi.ollamaUrl": "http://127.0.0.1:11434",  // Ollama 주소
  "connectAi.model": "llama3",                       // 모델명
  "connectAi.timeoutSec": 30,                        // 타임아웃(초)
  "connectAi.dbPath": "/path/to/고객관리.db"          // DB 경로 (비우면 자동 탐색)
}
```

## 빌드 (.vsix 직접 패키징)

```bash
npm install
npm run package
```

## 원본 프로젝트 대비 개선 사항

- `activationEvents: "*"` → 특정 커맨드 이벤트만 구독 (시작 성능 개선)
- `jsdom` 의존성 제거
- 외부 Agent University 포트(4825) 연결 완전 제거
- WebView ↔ Extension Host postMessage 프로토콜 타입 정의 (`src/types.ts`)
- Ollama 연결 실패 시 명확한 한국어 에러 메시지
- SQLite DB 직접 조회 기능 추가
- 개발 잔재 파일 없는 깔끔한 구조

## 라이선스

MIT
