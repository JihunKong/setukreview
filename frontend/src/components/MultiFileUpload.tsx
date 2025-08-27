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
  LinearProgress,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Fade,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  FolderOpen as FolderIcon,
} from '@mui/icons-material';
import { fileUploadApi } from '../services/api';

export interface UploadedFile {
  id: string;
  fileName: string;
  category: string;
  confidence: number;
  uploadedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileSize: number;
  file: File; // Original file object
  validationId?: string;
  metadata?: {
    sheetCount: number;
    detectedKeywords: string[];
    suggestedAlternatives: string[];
  };
}

interface MultiFileUploadProps {
  onSessionCreated: (sessionId: string, files: UploadedFile[]) => void;
  onError: (error: string) => void;
  maxFiles?: number;
  maxFileSize?: number;
}

export const MultiFileUpload: React.FC<MultiFileUploadProps> = ({
  onSessionCreated,
  onError,
  maxFiles = 50,
  maxFileSize = 10 * 1024 * 1024, // 10MB
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [currentlyUploading, setCurrentlyUploading] = useState<string>('');

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        onError(`파일 크기가 ${Math.round(maxFileSize / (1024 * 1024))}MB를 초과합니다: ${rejection.file.name}`);
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        onError(`지원하지 않는 파일 형식입니다: ${rejection.file.name}. Excel 파일(.xlsx, .xls, .xlsm)만 업로드 가능합니다.`);
      } else if (rejection.errors[0]?.code === 'too-many-files') {
        onError(`최대 ${maxFiles}개 파일까지만 업로드 가능합니다.`);
      } else {
        onError(`파일 업로드에 실패했습니다: ${rejection.file.name}`);
      }
      return;
    }

    // Check total file count including already selected files
    if (selectedFiles.length + acceptedFiles.length > maxFiles) {
      onError(`최대 ${maxFiles}개 파일까지만 선택할 수 있습니다.`);
      return;
    }

    // Add accepted files to selection
    setSelectedFiles(prev => [...prev, ...acceptedFiles]);
  }, [onError, maxFiles, maxFileSize, selectedFiles.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
    },
    maxFiles,
    maxSize: maxFileSize,
    multiple: true,
  });

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    console.log(`🚀 Starting multi-file upload with ${selectedFiles.length} files`);

    setIsUploading(true);
    setUploadProgress(0);
    setUploadedFiles([]);

    try {
      // First, create a session
      console.log('📝 Creating upload session...');
      setCurrentlyUploading('세션 생성 중...');
      const sessionData = await fileUploadApi.createSession('anonymous');
      
      console.log('📝 Session creation result:', sessionData);
      
      if (!sessionData.success) {
        throw new Error(`세션 생성 실패: ${sessionData.error || '알 수 없는 오류'}`);
      }

      const sessionId = sessionData.sessionId;
      console.log(`✅ Session created: ${sessionId}`);
      setUploadProgress(25);

      // Upload files to the session
      console.log(`📤 Uploading ${selectedFiles.length} files to session...`);
      console.log('Files to upload:', selectedFiles.map(f => ({ name: f.name, size: f.size })));
      
      setCurrentlyUploading('파일 업로드 중...');
      const uploadResult = await fileUploadApi.uploadMultipleFiles(sessionId, selectedFiles);
      setUploadProgress(75);
      
      console.log('📤 Upload result:', uploadResult);
      
      if (!uploadResult.success) {
        throw new Error(`파일 업로드 실패: ${uploadResult.error || '알 수 없는 오류'}`);
      }

      // Convert backend FileCategory to frontend UploadedFile format
      const convertedFiles: UploadedFile[] = uploadResult.uploadedFiles.map((file: any) => ({
        id: file.id,
        fileName: file.fileName,
        category: file.category,
        confidence: file.confidence,
        uploadedAt: new Date(file.uploadedAt),
        status: file.status,
        fileSize: file.fileSize,
        file: selectedFiles.find(f => f.name === file.fileName)!, // Find original File object
        validationId: file.validationId,
        metadata: file.metadata,
      }));

      console.log(`✅ Successfully converted ${convertedFiles.length} files`);
      setUploadedFiles(convertedFiles);
      setUploadProgress(100);

      // Report any errors
      if (uploadResult.errors && uploadResult.errors.length > 0) {
        console.warn('⚠️ Some files had errors:', uploadResult.errors);
        onError(`일부 파일 업로드 실패:\n${uploadResult.errors.join('\n')}`);
      }

      // Success callback
      console.log('🎉 Upload process completed successfully');
      onSessionCreated(sessionId, convertedFiles);

    } catch (error) {
      console.error('❌ Multi-file upload failed:', {
        error: error,
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      if (error instanceof Error) {
        onError(`업로드 실패: ${error.message}`);
      } else {
        onError('파일 업로드 중 예상치 못한 오류가 발생했습니다.');
      }
    } finally {
      setIsUploading(false);
      setCurrentlyUploading('');
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetFiles = () => {
    setSelectedFiles([]);
    setUploadedFiles([]);
    setUploadProgress(0);
  };

  const getCategoryDisplayName = (category: string): string => {
    // Backend returns Korean category names directly, so we just return them
    // with fallback mapping for any English keys that might exist
    const categoryNames: Record<string, string> = {
      'attendance': '출결상황',
      'personal_details': '개인세부능력 및 특기사항', 
      'personal_info': '인적사항',
      'academic_records': '교과학습발달상황',
      'behavior_records': '행동특성 및 종합의견',
      'career_guidance': '진로 지도 현황',
      'reading_records': '독서활동상황',
      'volunteer_activities': '봉사활동실적',
      'club_activities': '동아리활동상황',
      'awards': '수상경력',
      'qualifications': '자격증 및 인증 취득상황',
      'generic': '일반파일',
      // Korean categories from backend
      '출결상황': '출결상황',
      '개인세부능력': '개인세부능력 및 특기사항',
      '인적사항': '인적사항',
      '수상경력': '수상경력',
      '창의적체험활동': '창의적체험활동',
      '독서활동': '독서활동상황',
      '행동특성및종합의견': '행동특성 및 종합의견',
      '기타': '기타',
    };
    return categoryNames[category] || category;
  };

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  const hasOversizedFiles = selectedFiles.some(file => file.size > maxFileSize);

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        📁 다중 파일 업로드
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>지원 파일 형식:</strong> .xlsx, .xls, .xlsm<br />
          <strong>최대 파일 크기:</strong> {Math.round(maxFileSize / (1024 * 1024))}MB<br />
          <strong>최대 파일 개수:</strong> {maxFiles}개<br />
          <strong>자동 분류:</strong> 파일 내용에 따라 자동으로 카테고리가 분류됩니다
        </Typography>
      </Alert>

      {!isUploading && selectedFiles.length === 0 && (
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
          <FolderIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? '파일들을 여기에 놓으세요' : '여러 파일을 드래그하거나 클릭하여 선택하세요'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Excel 파일(.xlsx, .xls, .xlsm) 최대 {maxFiles}개 까지
          </Typography>
        </Box>
      )}

      {selectedFiles.length > 0 && !isUploading && (
        <Fade in={true}>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">
                  선택된 파일 ({selectedFiles.length}개)
                </Typography>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    총 크기: {formatFileSize(totalSize)}
                  </Typography>
                </Box>
              </Box>

              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {selectedFiles.map((file, index) => (
                  <ListItem key={`${file.name}-${index}`} sx={{ 
                    backgroundColor: file.size > maxFileSize ? 'error.light' : 'grey.50', 
                    borderRadius: 1, 
                    mb: 1 
                  }}>
                    <ListItemIcon>
                      <DescriptionIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      secondary={formatFileSize(file.size)}
                    />
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label={file.name.split('.').pop()?.toUpperCase()}
                        color="primary"
                        size="small"
                      />
                      {file.size <= maxFileSize ? (
                        <CheckCircleIcon color="success" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                      <Tooltip title="파일 제거">
                        <IconButton
                          size="small"
                          onClick={() => removeFile(index)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItem>
                ))}
              </List>

              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={handleUpload}
                  disabled={hasOversizedFiles || selectedFiles.length === 0}
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                >
                  {selectedFiles.length}개 파일 업로드 및 분류
                </Button>
                <Button
                  variant="outlined"
                  onClick={resetFiles}
                  startIcon={<RefreshIcon />}
                >
                  초기화
                </Button>
              </Box>

              {hasOversizedFiles && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  일부 파일이 크기 제한을 초과합니다. 해당 파일을 제거하거나 더 작은 파일로 교체해주세요.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Fade>
      )}

      {isUploading && (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CircularProgress size={24} sx={{ mr: 2 }} />
              <Typography variant="subtitle1">
                {currentlyUploading}
              </Typography>
            </Box>
            
            <LinearProgress 
              variant="determinate" 
              value={uploadProgress} 
              sx={{ mb: 2 }}
            />
            
            <Typography variant="body2" color="text.secondary" align="center">
              {uploadProgress}% 완료
            </Typography>

            {uploadedFiles.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  분류 결과:
                </Typography>
                <List dense>
                  {uploadedFiles.map((file) => (
                    <ListItem key={file.id} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.fileName}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip
                              label={getCategoryDisplayName(file.category)}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                            <Typography variant="caption" color="text.secondary">
                              신뢰도: {Math.round(file.confidence * 100)}%
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Paper>
  );
};