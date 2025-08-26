import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Grid,
  Card,
  CardContent,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { ValidationResult, ValidationError } from '../types/validation';
import { reportApi, downloadFile } from '../services/api';

interface ValidationResultsProps {
  validationResult: ValidationResult;
  onStartNew: () => void;
  onError: (error: string) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

export const ValidationResults: React.FC<ValidationResultsProps> = ({
  validationResult,
  onStartNew,
  onError,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [downloading, setDownloading] = useState(false);
  const [selectedError, setSelectedError] = useState<ValidationError | null>(null);

  const handleDownload = async (format: 'excel' | 'csv' | 'json') => {
    setDownloading(true);
    try {
      const blob = await reportApi.downloadReport(validationResult.id, format);
      const extension = format === 'excel' ? 'xlsx' : format;
      downloadFile(blob, `validation-report-${validationResult.id.slice(0, 8)}.${extension}`);
    } catch (error) {
      onError('보고서 다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  const getTabData = (tabIndex: number): ValidationError[] => {
    switch (tabIndex) {
      case 0: return validationResult.errors;
      case 1: return validationResult.warnings;
      case 2: return validationResult.info;
      default: return [];
    }
  };

  const getTypeDisplayName = (type: string): string => {
    const typeNames: Record<string, string> = {
      korean_english: '한글/영문',
      institution_name: '기관명',
      grammar: '문법',
      format: '형식',
      ai_validation: 'AI 검증'
    };
    return typeNames[type] || type;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <ErrorIcon color="error" fontSize="small" />;
      case 'warning': return <WarningIcon color="warning" fontSize="small" />;
      case 'info': return <InfoIcon color="info" fontSize="small" />;
      default: return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const currentData = getTabData(tabValue);
  const paginatedData = currentData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const processingTime = validationResult.completedAt && validationResult.createdAt
    ? new Date(validationResult.completedAt).getTime() - new Date(validationResult.createdAt).getTime()
    : null;

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          ✅ 검증 완료
        </Typography>
        <Button
          variant="outlined"
          onClick={onStartNew}
          startIcon={<RefreshIcon />}
        >
          새로 검증하기
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                총 셀 수
              </Typography>
              <Typography variant="h5">
                {validationResult.summary.totalCells.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'error.light' }}>
            <CardContent>
              <Typography color="error.contrastText" gutterBottom variant="body2">
                오류
              </Typography>
              <Typography variant="h5" color="error.contrastText">
                {validationResult.errors.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'warning.light' }}>
            <CardContent>
              <Typography color="warning.contrastText" gutterBottom variant="body2">
                경고
              </Typography>
              <Typography variant="h5" color="warning.contrastText">
                {validationResult.warnings.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: 'info.light' }}>
            <CardContent>
              <Typography color="info.contrastText" gutterBottom variant="body2">
                정보
              </Typography>
              <Typography variant="h5" color="info.contrastText">
                {validationResult.info.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Summary Information */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>파일명:</strong> {validationResult.fileName}<br />
          <strong>검증 시간:</strong> {processingTime ? `${Math.round(processingTime / 1000)}초` : 'N/A'}<br />
          <strong>완료 시각:</strong> {validationResult.completedAt ? new Date(validationResult.completedAt).toLocaleString('ko-KR') : 'N/A'}
        </Typography>
      </Alert>

      {/* Download Buttons */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={() => handleDownload('excel')}
          disabled={downloading}
        >
          Excel 다운로드
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => handleDownload('csv')}
          disabled={downloading}
        >
          CSV 다운로드
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => handleDownload('json')}
          disabled={downloading}
        >
          JSON 다운로드
        </Button>
      </Box>

      {/* Results Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorIcon fontSize="small" />
                오류 ({validationResult.errors.length})
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon fontSize="small" />
                경고 ({validationResult.warnings.length})
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon fontSize="small" />
                정보 ({validationResult.info.length})
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* Results Table */}
      <TabPanel value={tabValue} index={tabValue}>
        {currentData.length > 0 ? (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>심각도</TableCell>
                    <TableCell>유형</TableCell>
                    <TableCell>위치</TableCell>
                    <TableCell>메시지</TableCell>
                    <TableCell>원본 텍스트</TableCell>
                    <TableCell>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedData.map((item, index) => (
                    <TableRow key={`${item.id}-${index}`} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getSeverityIcon(item.severity)}
                          <Chip
                            label={item.severity}
                            color={getSeverityColor(item.severity) as any}
                            size="small"
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getTypeDisplayName(item.type)}
                          variant="outlined"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {item.location.sheet}!{item.location.cell}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Typography variant="body2" noWrap>
                          {item.message}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography variant="body2" noWrap fontFamily="monospace">
                          {item.originalText}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="상세 보기">
                          <IconButton
                            size="small"
                            onClick={() => setSelectedError(item)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={currentData.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="페이지당 행 수:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
            />
          </>
        ) : (
          <Alert severity="success" sx={{ mt: 2 }}>
            {tabValue === 0 ? '오류가 발견되지 않았습니다!' : 
             tabValue === 1 ? '경고가 발견되지 않았습니다!' : 
             '추가 정보가 없습니다!'}
          </Alert>
        )}
      </TabPanel>

      {/* Error Detail Dialog */}
      <Dialog
        open={!!selectedError}
        onClose={() => setSelectedError(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedError && (
          <>
            <DialogTitle>
              상세 정보
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>위치</Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {selectedError.location.sheet}!{selectedError.location.cell} (행: {selectedError.location.row}, 열: {selectedError.location.column})
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>유형</Typography>
                <Chip label={getTypeDisplayName(selectedError.type)} variant="outlined" />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>메시지</Typography>
                <Typography variant="body2">{selectedError.message}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>원본 텍스트</Typography>
                <Typography variant="body2" fontFamily="monospace" sx={{ p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                  {selectedError.originalText}
                </Typography>
              </Box>
              
              {selectedError.suggestion && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>제안사항</Typography>
                  <Typography variant="body2" color="primary">
                    {selectedError.suggestion}
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>규칙</Typography>
                <Typography variant="body2">{selectedError.rule}</Typography>
              </Box>
              
              {selectedError.confidence && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>신뢰도</Typography>
                  <Typography variant="body2">{Math.round(selectedError.confidence * 100)}%</Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedError(null)}>닫기</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Paper>
  );
};