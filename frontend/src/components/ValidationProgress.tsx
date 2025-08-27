import React, { useEffect, useState, useRef } from 'react';
import {
  Paper,
  Box,
  Typography,
  LinearProgress,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { validationApi } from '../services/api';
import { ValidationResult } from '../types/validation';

interface ValidationProgressProps {
  validationId: string;
  onValidationUpdate: (result: ValidationResult) => void;
  onValidationComplete: (result: ValidationResult) => void;
  onError: (error: string) => void;
}

export const ValidationProgress: React.FC<ValidationProgressProps> = ({
  validationId,
  onValidationUpdate,
  onValidationComplete,
  onError,
}) => {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const pollInterval = useRef<NodeJS.Timeout>();
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const pollValidation = async () => {
      if (isRetrying) return; // Skip if already retrying

      try {
        const validationResult = await validationApi.getValidation(validationId);
        setResult(validationResult);
        onValidationUpdate(validationResult);
        
        // Reset retry count on successful request
        setRetryCount(0);
        setIsRetrying(false);

        if (validationResult.status === 'completed') {
          onValidationComplete(validationResult);
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
          }
        } else if (validationResult.status === 'failed') {
          onError('검증 중 오류가 발생했습니다.');
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
          }
        }
      } catch (error: any) {
        // Handle rate limiting with exponential backoff
        if (error?.response?.status === 429) {
          const newRetryCount = retryCount + 1;
          setRetryCount(newRetryCount);
          setIsRetrying(true);

          // Stop retrying after 3 consecutive failures
          if (newRetryCount >= 3) {
            onError('서버가 과부하 상태입니다. 잠시 후 다시 시도해주세요.');
            if (pollInterval.current) {
              clearInterval(pollInterval.current);
            }
            return;
          }

          // Exponential backoff: 5s, 10s, 20s
          const backoffDelay = 5000 * Math.pow(2, newRetryCount - 1);
          setTimeout(() => {
            setIsRetrying(false);
            pollValidation();
          }, backoffDelay);
        } else {
          onError('검증 상태를 확인하는 중 오류가 발생했습니다.');
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
          }
        }
      }
    };

    // Initial poll with slight delay to avoid immediate rate limiting
    setTimeout(pollValidation, 1000);

    // Set up polling interval - increased from 2s to 5s to reduce rate limiting
    pollInterval.current = setInterval(pollValidation, 5000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [validationId, onValidationUpdate, onValidationComplete, onError, retryCount, isRetrying]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await validationApi.cancelValidation(validationId);
      onError('검증이 취소되었습니다.');
    } catch (error) {
      onError('검증 취소에 실패했습니다.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!result) {
    return (
      <Paper elevation={2} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LinearProgress sx={{ flexGrow: 1 }} />
          <Typography variant="body2">검증을 시작하고 있습니다...</Typography>
        </Box>
      </Paper>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'primary';
      case 'completed': return 'success';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기 중';
      case 'processing': return '검증 중';
      case 'completed': return '완료';
      case 'failed': return '실패';
      default: return status;
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          🔍 검증 진행 상황
        </Typography>
        <Chip
          label={getStatusText(result.status)}
          color={getStatusColor(result.status) as any}
          variant="filled"
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">
            파일: {result.fileName}
          </Typography>
          <Typography variant="body2">
            {result.progress}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={result.progress}
          sx={{ height: 8, borderRadius: 5 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            검사된 셀: {result.summary.checkedCells.toLocaleString()} / {result.summary.totalCells.toLocaleString()}
            {isRetrying && ` (재연결 중... ${retryCount}/3)`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            검증 ID: {validationId.slice(0, 8)}...
          </Typography>
        </Box>
      </Box>

      {(result.errors.length > 0 || result.warnings.length > 0 || result.info.length > 0) && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={4}>
            <Card variant="outlined" sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ErrorIcon fontSize="small" />
                  <Typography variant="h6">{result.errors.length}</Typography>
                </Box>
                <Typography variant="caption">오류</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card variant="outlined" sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon fontSize="small" />
                  <Typography variant="h6">{result.warnings.length}</Typography>
                </Box>
                <Typography variant="caption">경고</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card variant="outlined" sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoIcon fontSize="small" />
                  <Typography variant="h6">{result.info.length}</Typography>
                </Box>
                <Typography variant="caption">정보</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {result.status === 'processing' && (result.errors.length > 0 || result.warnings.length > 0) && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            발견된 주요 문제 (처음 5개):
          </Typography>
          <List dense>
            {[...result.errors, ...result.warnings].slice(0, 5).map((error, index) => (
              <ListItem key={`${error.id}-${index}`} sx={{ py: 0.5 }}>
                <ListItemText
                  primary={error.message}
                  secondary={`${error.location.sheet}!${error.location.cell} - ${error.originalText.slice(0, 50)}${error.originalText.length > 50 ? '...' : ''}`}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {result.status === 'processing' && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            color="error"
            onClick={handleCancel}
            disabled={isCancelling}
            startIcon={<CancelIcon />}
          >
            {isCancelling ? '취소 중...' : '검증 취소'}
          </Button>
        </Box>
      )}

      {result.status === 'completed' && (
        <Alert severity="success" sx={{ display: 'flex', alignItems: 'center' }}>
          <CheckCircleIcon sx={{ mr: 1 }} />
          검증이 완료되었습니다!
        </Alert>
      )}
    </Paper>
  );
};