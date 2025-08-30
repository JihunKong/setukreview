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
import BatchValidationResults from './components/BatchValidationResults/index';
import { WaitingEntertainment } from './components/WaitingEntertainment';
import { CategorySummary } from './components/CategorySidebar';
import { ValidationResult, SessionValidationStatus } from './types/validation';
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
  const [sessionValidationStatus, setSessionValidationStatus] = useState<SessionValidationStatus | null>(null);
  const [validationPollingActive, setValidationPollingActive] = useState(false);
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
    console.log('🚨 EMERGENCY DEBUG APP - handleSessionCreated called with:', {
      newSessionId,
      filesCount: files.length,
      files: files.map(f => ({
        id: f.id,
        fileName: f.fileName,
        category: f.category,
        confidence: f.confidence,
        status: f.status
      }))
    });
    
    console.log('🚨 EMERGENCY DEBUG APP - Setting session state...');
    setSessionId(newSessionId);
    console.log('🚨 EMERGENCY DEBUG APP - Setting uploaded files state...');
    setUploadedFiles(files);
    console.log('🚨 EMERGENCY DEBUG APP - Clearing error state...');
    setError(null);
    console.log('🚨 EMERGENCY DEBUG APP - Session creation completed:', {
      newSessionId,
      filesCount: files.length
    });
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
      console.log(`🚀 Starting validation for selected categories: ${selectedCategories.join(', ')}`);
      console.log(`🔍 Session ID: ${sessionId}`);
      console.log(`📁 Total uploaded files: ${uploadedFiles.length}`);
      
      // For now, validate all files since backend doesn't support category filtering
      const result = await validationApi.validateSession(sessionId);
      
      console.log(`✅ Validation API call completed for session ${sessionId}`);
      console.log('🔍 ULTRA DEBUG - Full result object:', JSON.stringify(result, null, 2));
      
      if (result.success && result.results) {
        // Convert results array to Map, filtering by selected categories
        const resultsMap = new Map<string, ValidationResult>();
        const categoryFiles = new Set();
        
        // Get file IDs for selected categories
        selectedCategories.forEach(category => {
          categories[category]?.files.forEach(file => categoryFiles.add(file.id));
        });
        
        result.results.forEach((validationResult: any) => {
          if (validationResult && validationResult.id && categoryFiles.has(validationResult.id)) {
            resultsMap.set(validationResult.id, validationResult as ValidationResult);
          }
        });
        
        console.log(`📊 Created filtered results map with ${resultsMap.size} entries for selected categories`);
        
        setBatchValidation({
          batchId: sessionId, // Use sessionId as batchId
          sessionId: result.sessionId,
          status: 'completed',
          progress: 100,
          results: resultsMap,
        });
        
        // Update file statuses only for selected categories
        setUploadedFiles(prev => prev.map(file => {
          if (categoryFiles.has(file.id)) {
            const validationResult = resultsMap.get(file.id);
            return validationResult ? {
              ...file,
              status: validationResult.status,
              validationId: validationResult.id
            } : file;
          }
          return file;
        }));
        
      } else {
        console.error('🚨 ULTRA DEBUG - Validation API returned unexpected result:', {
          success: result.success,
          hasResults: !!result.results,
          resultsLength: result.results?.length,
          message: result.message,
          fullResult: result
        });
        throw new Error(result.message || `검증 결과를 받지 못했습니다. (success: ${result.success}, results: ${result.results ? result.results.length : 'none'})`);
      }
      
    } catch (error) {
      console.error('🚨 ULTRA DEBUG - Validation failed with error:', {
        error,
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace'
      });
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
      console.log(`🚀 Starting CATEGORY validation for: ${category}`);
      console.log(`🔍 Session ID: ${sessionId}`);
      console.log(`📁 Total uploaded files: ${uploadedFiles.length}`);
      
      const result = await validationApi.validateSession(sessionId);
      
      console.log(`✅ CATEGORY validation API call completed for session ${sessionId}`);
      console.log('🔍 ULTRA DEBUG - Full CATEGORY validation result:', JSON.stringify(result, null, 2));
      
      if (result.success && result.results) {
        // Convert results array to Map, filtering by selected category
        const resultsMap = new Map<string, ValidationResult>();
        const categoryInfo = categories[category];
        const categoryFiles = categoryInfo?.files || [];
        const categoryFileIds = new Set(categoryFiles.map(file => file.id));
        
        result.results.forEach((validationResult: any) => {
          if (validationResult && validationResult.id && categoryFileIds.has(validationResult.id)) {
            resultsMap.set(validationResult.id, validationResult as ValidationResult);
          }
        });
        
        console.log(`📊 Created filtered results map with ${resultsMap.size} entries for category: ${category}`);
        
        setBatchValidation({
          batchId: sessionId, // Use sessionId as batchId
          sessionId: result.sessionId,
          status: 'completed',
          progress: 100,
          results: resultsMap,
        });
        
        // Update file statuses only for this category
        setUploadedFiles(prev => prev.map(file => {
          if (categoryFileIds.has(file.id)) {
            const validationResult = resultsMap.get(file.id);
            return validationResult ? {
              ...file,
              status: validationResult.status,
              validationId: validationResult.id
            } : file;
          }
          return file;
        }));
        
      } else {
        console.error('🚨 ULTRA DEBUG - CATEGORY validation API returned unexpected result:', {
          category,
          success: result.success,
          hasResults: !!result.results,
          resultsLength: result.results?.length,
          message: result.message,
          fullResult: result
        });
        throw new Error(result.message || `카테고리 검증 결과를 받지 못했습니다. (success: ${result.success}, results: ${result.results ? result.results.length : 'none'})`);
      }
      
    } catch (error) {
      console.error('🚨 ULTRA DEBUG - CATEGORY validation failed with error:', {
        category,
        error,
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace'
      });
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
      console.log(`🚀 Starting ALL validation for session: ${sessionId}`);
      console.log(`📁 Total uploaded files: ${uploadedFiles.length}`);
      
      // Start async validation
      const startResult = await validationApi.validateSession(sessionId);
      
      console.log(`✅ Validation started for session ${sessionId}:`, startResult);
      
      if (startResult.success) {
        // Start polling for status updates
        setValidationPollingActive(true);
        startValidationPolling(sessionId);
        
      } else {
        throw new Error(startResult.message || 'Failed to start validation');
      }
      
    } catch (error) {
      console.error('🚨 Failed to start validation:', error);
      setError(error instanceof Error ? error.message : '검증 시작에 실패했습니다.');
      setBatchValidation(prev => ({ ...prev, status: 'failed' }));
      setIsLoading(false);
    }
  };

  // Polling function for validation status updates
  const startValidationPolling = (sessionId: string) => {
    let pollAttempts = 0;
    const maxPollAttempts = 180; // 15 minutes with 5 second intervals
    
    const pollStatus = async () => {
      try {
        pollAttempts++;
        console.log(`📊 Polling validation status (${pollAttempts}/${maxPollAttempts})...`);
        
        const statusResult = await validationApi.getSessionValidationStatus(sessionId);
        
        if (statusResult.success) {
          setSessionValidationStatus(statusResult);
          
          console.log(`📈 Progress: ${statusResult.progress}% - ${statusResult.status}`);
          console.log(`🔄 Current file: ${statusResult.currentFile || 'N/A'}`);
          console.log(`📊 Files: ${statusResult.completedFiles}/${statusResult.totalFiles}`);
          
          // Update batch validation for compatibility
          setBatchValidation(prev => ({
            ...prev,
            progress: statusResult.progress,
            status: statusResult.status === 'processing' ? 'validating' : 
                   statusResult.status === 'completed' ? 'completed' : 
                   statusResult.status === 'failed' ? 'failed' : prev.status
          }));
          
          if (statusResult.status === 'completed') {
            console.log('🎉 Validation completed!');
            
            // Convert results to Map for compatibility
            const resultsMap = new Map<string, ValidationResult>();
            statusResult.results.forEach((result: ValidationResult) => {
              if (result && result.id) {
                resultsMap.set(result.id, result);
              }
            });
            
            setBatchValidation({
              batchId: sessionId,
              sessionId: sessionId,
              status: 'completed',
              progress: 100,
              results: resultsMap,
            });
            
            // Update file statuses
            setUploadedFiles(prev => prev.map(file => {
              const validationResult = resultsMap.get(file.id);
              return validationResult ? {
                ...file,
                status: validationResult.status,
                validationId: validationResult.id
              } : file;
            }));
            
            setValidationPollingActive(false);
            setIsLoading(false);
            
          } else if (statusResult.status === 'failed') {
            console.error('❌ Validation failed');
            setError('검증이 실패했습니다.');
            setValidationPollingActive(false);
            setIsLoading(false);
            
          } else if (pollAttempts >= maxPollAttempts) {
            console.error('⏰ Polling timeout reached');
            setError('검증이 너무 오래 걸리고 있습니다. 페이지를 새로고침해주세요.');
            setValidationPollingActive(false);
            setIsLoading(false);
            
          } else {
            // Continue polling
            setTimeout(pollStatus, 5000); // 5 second intervals
          }
          
        } else {
          throw new Error(statusResult.error || 'Failed to get validation status');
        }
        
      } catch (error) {
        console.error(`❌ Polling failed (attempt ${pollAttempts}):`, error);
        
        if (pollAttempts >= 3) {
          // Stop polling after 3 consecutive failures
          setError('검증 상태 확인에 실패했습니다.');
          setValidationPollingActive(false);
          setIsLoading(false);
        } else {
          // Retry after a delay
          setTimeout(pollStatus, 5000);
        }
      }
    };
    
    // Start polling immediately
    pollStatus();
  };

  // Session validation returns results immediately - no polling needed

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
      // Use real-time session validation status if available
      const progress = sessionValidationStatus?.progress ?? batchValidation.progress;
      const currentFile = sessionValidationStatus?.currentFile;
      const completedFiles = sessionValidationStatus?.completedFiles ?? uploadedFiles.filter(f => f.status === 'completed').length;
      const totalFiles = sessionValidationStatus?.totalFiles ?? uploadedFiles.length;
      
      // Calculate estimated time remaining
      const processingTimeSeconds = sessionValidationStatus?.summary.processingTimeSeconds ?? 0;
      const estimatedTimeRemaining = progress > 0 && processingTimeSeconds > 0
        ? Math.round(((100 - progress) / progress) * processingTimeSeconds)
        : progress > 0 
          ? Math.round(((100 - progress) / progress) * 60) // Fallback estimate
          : null;

      return (
        <WaitingEntertainment
          progress={progress}
          estimatedTimeRemaining={estimatedTimeRemaining || undefined}
          currentTask={currentFile ? `검증 중: ${currentFile}` : "파일 검증 중..."}
          totalFiles={totalFiles}
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
          sessionId={sessionId}
          onStartNew={handleStartNew}
          onError={handleError}
        />
      );
    }

    // Additional debug condition for completed status with empty results
    if (batchValidation.status === 'completed' && batchValidation.results.size === 0) {
      console.warn(`⚠️ Batch validation completed but no results found:`, {
        status: batchValidation.status,
        resultsSize: batchValidation.results.size,
        batchId: batchValidation.batchId,
        sessionId: batchValidation.sessionId
      });
      
      return (
        <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" gutterBottom color="error">
                ⚠️ 검증 완료되었지만 결과가 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                검증은 완료되었지만 결과를 불러올 수 없습니다.<br />
                새로고침하거나 다시 시도해주세요.
              </Typography>
            </CardContent>
          </Card>
        </Box>
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

      {/* Copyright Footer */}
      <Box
        component="footer"
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid',
          borderColor: 'divider',
          py: 1,
          px: 2,
          textAlign: 'center',
          zIndex: 1000,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          © 2025 완도고등학교 공지훈, 목포여자고등학교 강미나
        </Typography>
      </Box>
    </ThemeProvider>
  );
}

export default App;