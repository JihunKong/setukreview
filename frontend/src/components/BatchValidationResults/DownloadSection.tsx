import React, { useState } from 'react';
import {
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Chip,
  Tooltip,
  Grid,
  Paper
} from '@mui/material';
import {
  TableView as ExcelIcon,
  Description as CsvIcon,
  DataObject as JsonIcon,
  Archive as ZipIcon,
  GetApp as GetAppIcon,
  CloudDownload as CloudDownloadIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';

interface DownloadSectionProps {
  onDownload: (format: 'excel' | 'csv' | 'json' | 'zip', mergeResults?: boolean) => Promise<void>;
  downloading: boolean;
  totalFiles: number;
}

const DownloadSection: React.FC<DownloadSectionProps> = ({
  onDownload,
  downloading,
  totalFiles
}) => {
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const handleDownload = async (format: 'excel' | 'csv' | 'json' | 'zip', mergeResults = true) => {
    try {
      await onDownload(format, mergeResults);
      setNotification({
        open: true,
        message: `${format.toUpperCase()} 보고서 다운로드가 완료되었습니다!`,
        severity: 'success'
      });
    } catch (error) {
      setNotification({
        open: true,
        message: `다운로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        severity: 'error'
      });
    }
  };

  const downloadOptions = [
    {
      key: 'excel' as const,
      label: '통합 Excel',
      icon: <ExcelIcon />,
      description: '모든 파일을 하나의 Excel 워크북으로',
      color: '#4CAF50',
      gradient: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)'
    },
    {
      key: 'csv' as const,
      label: '통합 CSV',
      icon: <CsvIcon />,
      description: '모든 데이터를 CSV 형식으로',
      color: '#2196F3',
      gradient: 'linear-gradient(135deg, #2196F3 0%, #1976d2 100%)'
    },
    {
      key: 'json' as const,
      label: '통합 JSON',
      icon: <JsonIcon />,
      description: '개발자용 JSON 형식',
      color: '#9C27B0',
      gradient: 'linear-gradient(135deg, #9C27B0 0%, #7b1fa2 100%)'
    },
    {
      key: 'zip' as const,
      label: '개별 ZIP',
      icon: <ZipIcon />,
      description: '각 파일을 개별적으로 압축',
      color: '#FF9800',
      gradient: 'linear-gradient(135deg, #FF9800 0%, #f57c00 100%)'
    }
  ];

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Main Download Card */}
      <Paper 
        elevation={6}
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 3,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -50,
            right: -50,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
          }
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <CloudDownloadIcon sx={{ fontSize: 32, mr: 2 }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                📥 보고서 다운로드
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {totalFiles}개 파일의 검증 결과를 다양한 형식으로 다운로드
              </Typography>
            </Box>
          </Box>

          {/* Download Statistics */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Chip 
              icon={<GetAppIcon />} 
              label={`${totalFiles}개 파일`}
              sx={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontWeight: 600
              }}
            />
            <Chip 
              icon={<SpeedIcon />} 
              label="고속 다운로드"
              sx={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontWeight: 600
              }}
            />
          </Box>

          {/* Download Buttons Grid */}
          <Grid container spacing={2}>
            {downloadOptions.map((option) => (
              <Grid item xs={12} sm={6} md={3} key={option.key}>
                <Tooltip title={option.description} placement="top">
                  <Button
                    fullWidth
                    onClick={() => handleDownload(option.key, option.key !== 'zip')}
                    disabled={downloading}
                    startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : option.icon}
                    sx={{
                      background: option.gradient,
                      color: 'white',
                      border: 'none',
                      borderRadius: 3,
                      py: 1.5,
                      px: 3,
                      textTransform: 'none',
                      fontWeight: 600,
                      boxShadow: 4,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 8,
                        background: option.gradient,
                      },
                      '&:disabled': {
                        background: 'grey.400',
                        color: 'grey.600',
                        transform: 'none',
                        boxShadow: 'none',
                      }
                    }}
                  >
                    {downloading ? '다운로드 중...' : option.label}
                  </Button>
                </Tooltip>
              </Grid>
            ))}
          </Grid>

          {/* Download Instructions */}
          <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              📋 다운로드 옵션 안내
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <Box component="li">
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  <strong>통합 형식</strong>: 모든 파일의 결과를 하나의 보고서로 병합
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  <strong>개별 ZIP</strong>: 각 파일의 보고서를 개별적으로 압축하여 제공
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Download Progress Overlay */}
      {downloading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              보고서 준비 중...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              잠시만 기다려 주세요
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Success/Error Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          severity={notification.severity}
          variant="filled"
          sx={{ minWidth: 300 }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DownloadSection;