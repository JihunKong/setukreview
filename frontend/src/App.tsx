import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Alert,
  Snackbar,
} from '@mui/material';
import { FileUpload } from './components/FileUpload';
import { ValidationProgress } from './components/ValidationProgress';
import { ValidationResults } from './components/ValidationResults';
import { ValidationResult } from './types/validation';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Noto Sans KR", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
  },
});

function App() {
  const [validationId, setValidationId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUploadSuccess = (newValidationId: string) => {
    setValidationId(newValidationId);
    setValidationResult(null);
    setError(null);
  };

  const handleValidationUpdate = (result: ValidationResult) => {
    setValidationResult(result);
  };

  const handleValidationComplete = (result: ValidationResult) => {
    setValidationResult(result);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleStartNew = () => {
    setValidationId(null);
    setValidationResult(null);
    setError(null);
  };

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', py: 4 }}>
        <Container maxWidth="lg">
          <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center" color="primary">
              📚 학교생활기록부 점검 도우미
            </Typography>
            <Typography variant="h6" component="h2" gutterBottom align="center" color="text.secondary">
              나이스(NEIS) 엑셀 파일을 업로드하여 자동 점검받으세요
            </Typography>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                • 한글/영문 입력 규칙 검증
                • 기관명 입력 규칙 검증  
                • 문법 및 형식 검사
                • AI 기반 내용 검증
              </Typography>
            </Box>
          </Paper>

          {!validationId && (
            <FileUpload
              onUploadSuccess={handleUploadSuccess}
              onError={handleError}
            />
          )}

          {validationId && !validationResult?.completedAt && (
            <ValidationProgress
              validationId={validationId}
              onValidationUpdate={handleValidationUpdate}
              onValidationComplete={handleValidationComplete}
              onError={handleError}
            />
          )}

          {validationResult?.status === 'completed' && (
            <ValidationResults
              validationResult={validationResult}
              onStartNew={handleStartNew}
              onError={handleError}
            />
          )}

          {validationResult?.status === 'failed' && (
            <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
              <Alert severity="error" sx={{ mb: 2 }}>
                검증 중 오류가 발생했습니다.
              </Alert>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={handleStartNew}>
                  새로 시작하기
                </button>
              </Box>
            </Paper>
          )}

          <Snackbar
            open={!!error}
            autoHideDuration={6000}
            onClose={handleCloseError}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
              {error}
            </Alert>
          </Snackbar>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;