# 🚀 SetuKReview 배포 가이드

## 📋 개요

학교생활기록부 점검 도우미는 나이스(NEIS)에서 다운받은 엑셀 파일을 자동으로 검증하는 웹 애플리케이션입니다.

## 🛠 기술 스택

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, Material-UI, TypeScript
- **AI**: OpenAI GPT-3.5-turbo
- **Deployment**: Railway
- **File Processing**: xlsx 라이브러리

## 🚀 Railway 배포

### 1. 환경 변수 설정

Railway 대시보드에서 다음 환경 변수를 설정하세요:

```bash
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=production
PORT=8080
```

### 2. 자동 배포 설정

1. GitHub 저장소를 Railway에 연결
2. Git push 시 자동 배포 활성화
3. 빌드 명령어: `npm run build`
4. 시작 명령어: `npm start`

### 3. 헬스체크 설정

- 헬스체크 경로: `/api/health`
- 타임아웃: 300초

## 🏗 로컬 개발 환경 설정

### 1. 의존성 설치

```bash
# 루트 디렉토리에서
npm install

# 백엔드 의존성 설치
cd backend
npm install

# 프론트엔드 의존성 설치
cd ../frontend
npm install
```

### 2. 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

### 3. 개발 서버 실행

```bash
# 루트 디렉토리에서 백엔드와 프론트엔드 동시 실행
npm run dev
```

또는 개별 실행:

```bash
# 백엔드 (포트 8080)
cd backend
npm run dev

# 프론트엔드 (포트 3000)
cd frontend
npm start
```

## 📝 API 엔드포인트

### 파일 업로드
- `POST /api/upload` - Excel 파일 업로드 및 검증 시작
- `GET /api/upload/status` - 업로드 상태 정보

### 검증
- `GET /api/validation/:id` - 검증 상태 조회
- `DELETE /api/validation/:id` - 검증 취소
- `GET /api/validation/:id/stats` - 검증 통계 조회

### 보고서
- `GET /api/report/:id/download?format=excel` - 보고서 다운로드
- `GET /api/report/:id/summary` - 보고서 요약 조회

### 시스템
- `GET /api/health` - 헬스체크

## 🔍 검증 규칙

1. **한글/영문 입력 규칙**: 허용된 영문 표현만 사용 가능
2. **기관명 입력 규칙**: 구체적인 기관명 사용 금지
3. **문법 검사**: 마침표, 띄어쓰기, 조사 사용법 검사
4. **형식 검사**: 특수문자, 따옴표 형식 검사
5. **AI 검증**: OpenAI를 통한 내용 적절성 검사

## 🧪 테스트

```bash
# 백엔드 테스트
cd backend
npm test

# 프론트엔드 테스트
cd frontend
npm test

# 전체 테스트
npm test
```

## 📦 프로덕션 빌드

```bash
npm run build
```

## 🐳 Docker 배포

```bash
# Docker 이미지 빌드
docker build -t setukreview .

# Docker 컨테이너 실행
docker run -p 8080:8080 -e OPENAI_API_KEY=your_key setukreview
```

## 🔧 설정

### 파일 업로드 제한
- 최대 파일 크기: 10MB
- 지원 파일 형식: .xlsx, .xls, .xlsm
- 동시 업로드 제한: 1개 파일

### 보안 설정
- Helmet을 통한 보안 헤더 설정
- Rate limiting 적용
- CORS 정책 설정

### 성능 최적화
- 압축 미들웨어 적용
- 정적 파일 캐싱
- 메모리 기반 임시 저장

## 📊 모니터링

### 헬스체크
```bash
curl https://your-railway-url.railway.app/api/health
```

### 로그 모니터링
Railway 대시보드에서 실시간 로그 확인 가능

## 🚨 문제 해결

### 1. 파일 업로드 실패
- 파일 크기 확인 (10MB 이하)
- 파일 형식 확인 (.xlsx, .xls, .xlsm)
- 네트워크 연결 상태 확인

### 2. AI 검증 실패
- OpenAI API 키 설정 확인
- API 사용량 한도 확인

### 3. 빌드 실패
- Node.js 버전 확인 (18.x 권장)
- 의존성 설치 상태 확인

## 📞 지원

문제가 발생할 경우 다음을 확인해주세요:

1. 환경 변수 설정 상태
2. Railway 배포 로그
3. 브라우저 개발자 도구 콘솔
4. API 응답 상태 코드

---

## 📈 성능 메트릭

- 파일 업로드: ~30초 (10MB 기준)
- 검증 속도: ~1초당 100셀
- 메모리 사용량: ~200MB (평균)
- 응답 시간: <2초 (API 평균)