import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Fade,
  Tabs,
  Tab,
  Card,
  CardContent,
  Typography,
  useMediaQuery
} from '@mui/material';
import { 
  Dashboard as DashboardIcon,
  Assessment as ChartIcon,
  List as ListIcon 
} from '@mui/icons-material';
import { ValidationResult } from '../../types/validation';
import { ValidationResults } from '../ValidationResults';
import SummaryCards from './SummaryCards';
import FileList from './FileList';
import DownloadSection from './DownloadSection';
import ProgressChart from './ProgressChart';

// Create enhanced theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a202c',
      secondary: '#718096',
    },
  },
  typography: {
    fontFamily: '"Noto Sans KR", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      color: '#1a202c',
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    }
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0,0,0,0.05)',
    '0px 4px 8px rgba(0,0,0,0.08)',
    '0px 8px 16px rgba(0,0,0,0.1)',
    '0px 12px 24px rgba(0,0,0,0.12)',
    '0px 16px 32px rgba(0,0,0,0.14)',
    '0px 20px 40px rgba(0,0,0,0.16)',
    '0px 24px 48px rgba(0,0,0,0.18)',
    '0px 28px 56px rgba(0,0,0,0.2)',
    ...Array(16).fill('none')
  ] as any,
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 4px 20px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

interface BatchValidationResultsProps {
  batchResults: Map<string, ValidationResult>;
  uploadedFiles: Array<{ fileName: string; category?: string; }>;
  sessionId?: string;
  onStartNew: () => void;
  onError: (error: string) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index} style={{ width: '100%' }}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const BatchValidationResults: React.FC<BatchValidationResultsProps> = ({
  batchResults,
  uploadedFiles,
  sessionId,
  onStartNew,
  onError
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(() => {
    return batchResults.size > 0 ? Array.from(batchResults.keys())[0] : null;
  });
  const [downloading, setDownloading] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  console.log(`📋 Enhanced BatchValidationResults component received:`, {
    batchResultsSize: batchResults.size,
    uploadedFilesCount: uploadedFiles.length,
    sessionId
  });

  // Calculate batch statistics
  const batchStats = {
    totalFiles: batchResults.size,
    totalErrors: Array.from(batchResults.values()).reduce((sum, result) => 
      sum + (result.errors?.length || 0), 0
    ),
    totalWarnings: Array.from(batchResults.values()).reduce((sum, result) => 
      sum + (result.warnings?.length || 0), 0
    ),
    totalInfo: Array.from(batchResults.values()).reduce((sum, result) => 
      sum + (result.info?.length || 0), 0
    ),
    totalCells: Array.from(batchResults.values()).reduce((sum, result) => 
      sum + (result.summary?.totalCells || 0), 0
    )
  };

  // Group files by category
  const filesByCategory = Array.from(batchResults.entries()).reduce((acc, [fileId, result]) => {
    const fileName = result.fileName || `File ${fileId}`;
    const category = uploadedFiles.find(f => f.fileName === fileName)?.category || '기타';
    
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ fileId, result });
    return acc;
  }, {} as Record<string, Array<{ fileId: string; result: ValidationResult }>>);

  const selectedResult = selectedFileId ? batchResults.get(selectedFileId) : null;

  // Download handlers
  const handleBatchDownload = async (format: 'excel' | 'csv' | 'json' | 'zip', mergeResults = true) => {
    setDownloading(true);
    try {
      const validationIds = Array.from(batchResults.keys());
      
      // Import the API functions
      const { reportApi, downloadFile } = await import('../../services/api');
      
      const blob = await reportApi.downloadBatchReport(validationIds, format, mergeResults);
      
      const timestamp = new Date().toISOString().slice(0, 10);
      const extension = format === 'excel' ? 'xlsx' : format === 'zip' ? 'zip' : format;
      const filename = `일괄검증보고서_${timestamp}.${extension}`;
      
      downloadFile(blob, filename);
      
    } catch (error) {
      onError(error instanceof Error ? error.message : '보고서 다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        minHeight: '100vh', 
        backgroundColor: 'background.default',
        pb: 8 // Space for floating elements
      }}>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Fade in timeout={1000}>
            <Box>
              {/* Summary Cards */}
              <SummaryCards stats={batchStats} />

              {/* Main Content Area */}
              {isMobile ? (
                // Mobile: Tab-based layout
                <Box>
                  <Tabs 
                    value={currentTab} 
                    onChange={(_, newValue) => setCurrentTab(newValue)}
                    variant="fullWidth"
                    sx={{ mb: 3 }}
                  >
                    <Tab icon={<ListIcon />} label="파일 목록" />
                    <Tab icon={<DashboardIcon />} label="상세 결과" />
                    <Tab icon={<ChartIcon />} label="진행 현황" />
                  </Tabs>
                  
                  <TabPanel value={currentTab} index={0}>
                    <FileList
                      filesByCategory={filesByCategory}
                      selectedFileId={selectedFileId}
                      onFileSelect={setSelectedFileId}
                    />
                  </TabPanel>
                  
                  <TabPanel value={currentTab} index={1}>
                    {selectedResult ? (
                      <ValidationResults
                        validationResult={selectedResult}
                        onStartNew={onStartNew}
                        onError={onError}
                      />
                    ) : (
                      <Card>
                        <CardContent sx={{ textAlign: 'center', py: 8 }}>
                          <Typography variant="h6" color="text.secondary">
                            파일을 선택하여 상세 결과를 확인하세요.
                          </Typography>
                        </CardContent>
                      </Card>
                    )}
                  </TabPanel>
                  
                  <TabPanel value={currentTab} index={2}>
                    <ProgressChart filesByCategory={filesByCategory} />
                  </TabPanel>
                </Box>
              ) : (
                // Desktop: Grid layout
                <Box>
                  <Grid container spacing={4}>
                    {/* Left Column: File List only */}
                    <Grid item md={4}>
                      <Box sx={{ position: 'sticky', top: 24 }}>
                        <FileList
                          filesByCategory={filesByCategory}
                          selectedFileId={selectedFileId}
                          onFileSelect={setSelectedFileId}
                        />
                      </Box>
                    </Grid>

                    {/* Right Column: Selected Result */}
                    <Grid item md={8}>
                      {selectedResult ? (
                        <Fade in key={selectedFileId} timeout={500}>
                          <Box>
                            <ValidationResults
                              validationResult={selectedResult}
                              onStartNew={onStartNew}
                              onError={onError}
                            />
                          </Box>
                        </Fade>
                      ) : (
                        <Card sx={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h5" color="text.secondary" gutterBottom>
                              파일을 선택해주세요
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                              왼쪽 목록에서 파일을 선택하면 상세 검증 결과를 확인할 수 있습니다.
                            </Typography>
                          </CardContent>
                        </Card>
                      )}
                    </Grid>
                  </Grid>

                  {/* Progress Chart: Full width below main content */}
                  <Box sx={{ mt: 4 }}>
                    <ProgressChart filesByCategory={filesByCategory} />
                  </Box>
                </Box>
              )}

              {/* Download Section */}
              <Box sx={{ mt: 4 }}>
                <DownloadSection
                  onDownload={handleBatchDownload}
                  downloading={downloading}
                  totalFiles={batchStats.totalFiles}
                />
              </Box>
            </Box>
          </Fade>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default BatchValidationResults;