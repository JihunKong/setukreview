import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Paper,
  Box,
  Typography,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { fileUploadApi } from '../services/api';

interface FileUploadProps {
  onUploadSuccess: (validationId: string) => void;
  onError: (error: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess, onError }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        onError('파일 크기가 10MB를 초과합니다.');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        onError('Excel 파일(.xlsx, .xls, .xlsm)만 업로드 가능합니다.');
      } else {
        onError('파일 업로드에 실패했습니다.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, [onError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const result = await fileUploadApi.uploadFile(selectedFile);
      
      if (result.success && result.validationId) {
        onUploadSuccess(result.validationId);
      } else {
        onError(result.error || '파일 업로드에 실패했습니다.');
      }
    } catch (error) {
      if (error instanceof Error) {
        onError(error.message);
      } else {
        onError('파일 업로드 중 오류가 발생했습니다.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetFile = () => {
    setSelectedFile(null);
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        📁 파일 업로드
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>지원 파일 형식:</strong> .xlsx, .xls, .xlsm<br />
          <strong>최대 파일 크기:</strong> 10MB
        </Typography>
      </Alert>

      {!selectedFile ? (
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'action.hover',
            },
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? '파일을 여기에 놓으세요' : '파일을 드래그하거나 클릭하여 선택하세요'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Excel 파일(.xlsx, .xls, .xlsm) 지원
          </Typography>
        </Box>
      ) : (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            선택된 파일:
          </Typography>
          <List>
            <ListItem sx={{ backgroundColor: 'grey.50', borderRadius: 1 }}>
              <ListItemIcon>
                <DescriptionIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={selectedFile.name}
                secondary={formatFileSize(selectedFile.size)}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label={selectedFile.name.split('.').pop()?.toUpperCase()}
                  color="primary"
                  size="small"
                />
                {selectedFile.size <= 10 * 1024 * 1024 ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <ErrorIcon color="error" />
                )}
              </Box>
            </ListItem>
          </List>

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={isUploading || selectedFile.size > 10 * 1024 * 1024}
              startIcon={isUploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
              fullWidth
            >
              {isUploading ? '업로드 중...' : '검증 시작'}
            </Button>
            <Button
              variant="outlined"
              onClick={resetFile}
              disabled={isUploading}
            >
              다시 선택
            </Button>
          </Box>

          {selectedFile.size > 10 * 1024 * 1024 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              파일 크기가 10MB를 초과합니다. 더 작은 파일을 선택해주세요.
            </Alert>
          )}
        </Box>
      )}
    </Paper>
  );
};