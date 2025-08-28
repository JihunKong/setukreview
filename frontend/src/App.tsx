import React, { useState, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Alert,
  Snackbar,
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
} from '@mui/material';
import { DashboardLayout } from './components/DashboardLayout';
import { MultiFileUpload, UploadedFile } from './components/MultiFileUpload';
import BatchValidationResults from './components/BatchValidationResults';
import { WaitingEntertainment } from './components/WaitingEntertainment';
import { CategorySummary } from './components/CategorySidebar';
import { ValidationResult } from './types/validation';
import { fileUploadApi, validationApi } from './services/api';
import { APP_VERSION, BUILD_TIMESTAMP, CACHE_BUSTER } from './version';

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

interface BatchValidationState {
  batchId: string | null;
  sessionId: string | null;
  status: 'idle' | 'uploading' | 'validating' | 'completed' | 'failed';
  progress: number;
  results: Map<string, ValidationResult>;
}

function App() {
  // Session and file management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [categories, setCategories] = useState<CategorySummary>({});
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Validation state
  const [batchValidation, setBatchValidation] = useState<BatchValidationState>({
    batchId: null,
    sessionId: null,
    status: 'idle',
    progress: 0,
    results: new Map(),
  });

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Log app initialization
  useEffect(() => {
    console.log(`🚀 SetuKReview App v${APP_VERSION} Starting...`);
    console.log('🔧 Environment Info:', {
      version: APP_VERSION,
      buildTimestamp: BUILD_TIMESTAMP,
      cacheBuster: CACHE_BUSTER,
      NODE_ENV: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      location: window.location.href,
    });
  }, []);

  // Update categories when files change
  useEffect(() => {
    if (uploadedFiles.length > 0) {
      const newCategories: CategorySummary = {};
      
      uploadedFiles.forEach(file => {
        if (!newCategories[file.category]) {
          newCategories[file.category] = {
            count: 0,
            files: [],
            avgConfidence: 0,
            status: 'pending'
          };
        }
        
        newCategories[file.category].count++;
        newCategories[file.category].files.push(file);
      });

      // Calculate averages and status for each category
      Object.keys(newCategories).forEach(categoryKey => {
        const category = newCategories[categoryKey];
        category.avgConfidence = category.files.reduce((sum, f) => sum + f.confidence, 0) / category.files.length;
        
        const statuses = Array.from(new Set(category.files.map(f => f.status)));
        if (statuses.length === 1) {
          category.status = statuses[0] as any;
        } else {
          category.status = 'mixed';
        }
      });

      setCategories(newCategories);
    }
  }, [uploadedFiles]);

  // Handle session creation and file uploads
  const handleSessionCreated = (newSessionId: string, files: UploadedFile[]) => {
    setSessionId(newSessionId);
    setUploadedFiles(files);
    setError(null);
    console.log(`Session created: ${newSessionId} with ${files.length} files`);
  };

  // Category selection handlers
  const handleCategorySelect = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSelectAll = () => {
    setSelectedCategories(Object.keys(categories));
  };

  const handleDeselectAll = () => {
    setSelectedCategories([]);
  };

  // Validation handlers
  const handleValidateSelected = async () => {
    if (!sessionId || selectedCategories.length === 0) return;
    
    setIsLoading(true);
    setBatchValidation(prev => ({ ...prev, status: 'validating' }));

    try {
      const options = {
        validateAll: false,
        selectedCategories,
        priority: 'balanced',
        maxConcurrency: 3,
      };

      const result = await validationApi.startBatchValidation(sessionId, options);
      setBatchValidation({
        batchId: result.batchId,
        sessionId: result.sessionId,
        status: 'validating',
        progress: 0,
        results: new Map(),
      });

      // Start polling for results
      pollBatchValidation(result.batchId);
      
    } catch (error) {
      console.error('Validation failed:', error);
      setError(error instanceof Error ? error.message : '검증 시작에 실패했습니다.');
      setBatchValidation(prev => ({ ...prev, status: 'failed' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateCategory = async (category: string) => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setBatchValidation(prev => ({ ...prev, status: 'validating' }));

    try {
      const result = await validationApi.validateCategory(sessionId, category);
      setBatchValidation({
        batchId: result.batchId,
        sessionId: result.sessionId,
        status: 'validating',
        progress: 0,
        results: new Map(),
      });

      pollBatchValidation(result.batchId);
      
    } catch (error) {
      console.error('Category validation failed:', error);
      setError(error instanceof Error ? error.message : '카테고리 검증에 실패했습니다.');
      setBatchValidation(prev => ({ ...prev, status: 'failed' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateAll = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setBatchValidation(prev => ({ ...prev, status: 'validating' }));

    try {
      const result = await validationApi.validateAll(sessionId);
      setBatchValidation({
        batchId: result.batchId,
        sessionId: result.sessionId,
        status: 'validating',
        progress: 0,
        results: new Map(),
      });

      pollBatchValidation(result.batchId);
      
    } catch (error) {
      console.error('Validation failed:', error);
      setError(error instanceof Error ? error.message : '전체 검증에 실패했습니다.');
      setBatchValidation(prev => ({ ...prev, status: 'failed' }));
    } finally {
      setIsLoading(false);
    }
  };

  // Poll batch validation results
  const pollBatchValidation = async (batchId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const result = await validationApi.getBatchValidation(batchId);
        
        console.log(`🔍 Poll result debug:`, {
          batchId,
          status: result.status,
          progress: result.progress,
          resultKeys: Object.keys(result.results || {}),
          resultCount: Object.keys(result.results || {}).length,
          fullResult: result
        });
        
        const resultsMap = new Map(Object.entries(result.results || {}));
        console.log(`📊 Results Map created with ${resultsMap.size} entries:`, Array.from(resultsMap.keys()));
        
        setBatchValidation(prev => {
          const updated = {
            ...prev,
            status: result.status === 'completed' ? 'completed' : prev.status,
            progress: result.progress,
            results: resultsMap,
          };
          
          console.log(`🔄 Updating batch validation state:`, {
            prevResultsSize: prev.results.size,
            newResultsSize: updated.results.size,
            status: updated.status
          });
          
          return updated;
        });

        // Update file statuses
        setUploadedFiles(prev => prev.map(file => {
          const validationResult = result.results[file.id];
          return validationResult ? {
            ...file,
            status: validationResult.status,
            validationId: validationResult.id,
          } : file;
        }));

        if (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled') {
          console.log(`✅ Polling completed. Final results count: ${resultsMap.size}`);
          clearInterval(pollInterval);
        }
        
      } catch (error) {
        console.error('Poll error:', error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    // Cleanup after 10 minutes
    setTimeout(() => clearInterval(pollInterval), 10 * 60 * 1000);
  };

  const handleRefresh = async () => {
    if (!sessionId) return;
    
    try {
      const sessionData = await fileUploadApi.getSession(sessionId);
      if (sessionData.success) {
        const files: UploadedFile[] = sessionData.files.map((file: any) => ({
          id: file.id,
          fileName: file.fileName,
          category: file.category,
          confidence: file.confidence,
          uploadedAt: new Date(file.uploadedAt),
          status: file.status,
          fileSize: file.fileSize,
          file: new File([], file.fileName), // Dummy file object
          validationId: file.validationId,
          metadata: file.metadata,
        }));
        setUploadedFiles(files);
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      setError('데이터 새로고침에 실패했습니다.');
    }
  };

  const handleStartNew = () => {
    setSessionId(null);
    setUploadedFiles([]);
    setCategories({});
    setSelectedCategories([]);
    setBatchValidation({
      batchId: null,
      sessionId: null,
      status: 'idle',
      progress: 0,
      results: new Map(),
    });
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleCloseError = () => {
    setError(null);
  };

  // Render main content based on current state
  const renderMainContent = () => {
    if (!sessionId) {
      return (
        <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
          <Paper elevation={3} sx={{ p: 4, mb: 4, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              🚀 시작하기
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              여러 Excel 파일을 한 번에 업로드하고, 자동으로 분류된 카테고리별로 검증할 수 있습니다.
            </Typography>
          </Paper>
          
          <MultiFileUpload
            onSessionCreated={handleSessionCreated}
            onError={handleError}
          />
        </Box>
      );
    }

    if (batchValidation.status === 'validating') {
      // Calculate estimated time remaining based on progress
      const completedFiles = uploadedFiles.filter(f => f.status === 'completed').length;
      const estimatedTimeRemaining = batchValidation.progress > 0 
        ? Math.round(((100 - batchValidation.progress) / batchValidation.progress) * 60) // Rough estimate in seconds
        : null;

      return (
        <WaitingEntertainment
          progress={batchValidation.progress}
          estimatedTimeRemaining={estimatedTimeRemaining || undefined}
          currentTask="파일 검증 중..."
          totalFiles={uploadedFiles.length}
          completedFiles={completedFiles}
        />
      );
    }

    if (batchValidation.status === 'completed' && batchValidation.results.size > 0) {
      console.log(`🎯 Rendering BatchValidationResults with:`, {
        status: batchValidation.status,
        resultsSize: batchValidation.results.size,
        resultKeys: Array.from(batchValidation.results.keys()),
        uploadedFilesCount: uploadedFiles.length
      });
      
      return (
        <BatchValidationResults
          batchResults={batchValidation.results}
          uploadedFiles={uploadedFiles}
          onStartNew={handleStartNew}
          onError={handleError}
        />
      );
    }

    console.log(`⚠️ Rendering default upload complete state:`, {
      batchValidationStatus: batchValidation.status,
      resultsSize: batchValidation.results.size,
      uploadedFilesLength: uploadedFiles.length,
      condition1: batchValidation.status === 'completed',
      condition2: batchValidation.results.size > 0,
      bothConditions: batchValidation.status === 'completed' && batchValidation.results.size > 0
    });

    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" gutterBottom>
              📋 파일 업로드 완료
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {uploadedFiles.length}개 파일이 업로드되었습니다.<br />
              사이드바에서 카테고리를 선택하여 검증을 시작하세요.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      {sessionId && uploadedFiles.length > 0 ? (
        <DashboardLayout
          categories={categories}
          selectedCategories={selectedCategories}
          onCategorySelect={handleCategorySelect}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onValidateSelected={handleValidateSelected}
          onValidateCategory={handleValidateCategory}
          onValidateAll={handleValidateAll}
          isValidating={batchValidation.status === 'validating' || isLoading}
          totalFiles={uploadedFiles.length}
          onRefresh={handleRefresh}
        >
          {renderMainContent()}
        </DashboardLayout>
      ) : (
        <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
          {renderMainContent()}
        </Box>
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={8000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;