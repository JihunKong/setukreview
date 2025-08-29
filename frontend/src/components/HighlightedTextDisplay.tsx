import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Fade,
  Alert,
  Chip,
  Divider
} from '@mui/material';
import {
  ViewList as TableViewIcon,
  Highlight as HighlightViewIcon,
  Code as RawViewIcon
} from '@mui/icons-material';
import { ValidationError } from '../types/validation';
import ErrorHighlighter from './ErrorHighlighter';

interface HighlightedTextDisplayProps {
  originalText: string;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  onErrorClick?: (error: ValidationError) => void;
  fileName?: string;
}

type ViewMode = 'highlight' | 'raw' | 'marked';

const HighlightedTextDisplay: React.FC<HighlightedTextDisplayProps> = ({
  originalText,
  errors,
  warnings,
  info,
  onErrorClick,
  fileName
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('highlight');
  
  const allIssues = [...errors, ...warnings, ...info];
  const issuesWithHighlight = allIssues.filter(issue => issue.highlightRange);
  
  const handleViewModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: ViewMode
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  const renderMarkedHTML = () => {
    // Use the markedText from errors if available
    let displayText = originalText;
    
    // Find the first error with markedText
    const errorWithMarkedText = allIssues.find(issue => issue.markedText);
    if (errorWithMarkedText?.markedText) {
      displayText = errorWithMarkedText.markedText;
    }
    
    return (
      <Box
        sx={{
          fontFamily: 'monospace',
          lineHeight: 1.6,
          '& .error-highlight': {
            backgroundColor: '#ffcdd2',
            padding: '2px 4px',
            borderRadius: '4px',
            border: '1px solid #f44336'
          },
          '& .warning-highlight': {
            backgroundColor: '#fff9c4',
            padding: '2px 4px',
            borderRadius: '4px',
            border: '1px solid #ff9800'
          },
          '& .info-highlight': {
            backgroundColor: '#e1f5fe',
            padding: '2px 4px',
            borderRadius: '4px',
            border: '1px solid #2196f3'
          }
        }}
        dangerouslySetInnerHTML={{ __html: displayText }}
      />
    );
  };

  const getIssuesSummary = () => {
    const summary = {
      error: errors.length,
      warning: warnings.length,
      info: info.length
    };
    
    return (
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {summary.error > 0 && (
          <Chip 
            label={`오류 ${summary.error}개`} 
            color="error" 
            size="small" 
            variant="outlined"
          />
        )}
        {summary.warning > 0 && (
          <Chip 
            label={`경고 ${summary.warning}개`} 
            color="warning" 
            size="small" 
            variant="outlined"
          />
        )}
        {summary.info > 0 && (
          <Chip 
            label={`정보 ${summary.info}개`} 
            color="info" 
            size="small" 
            variant="outlined"
          />
        )}
      </Box>
    );
  };

  return (
    <Paper elevation={1} sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          📝 원본 텍스트 {fileName && `(${fileName})`}
        </Typography>
        
        {getIssuesSummary()}
        
        {/* View Mode Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
          sx={{ mb: 2 }}
        >
          <ToggleButton value="highlight">
            <HighlightViewIcon fontSize="small" sx={{ mr: 1 }} />
            하이라이트 뷰
          </ToggleButton>
          <ToggleButton value="marked">
            <RawViewIcon fontSize="small" sx={{ mr: 1 }} />
            마크업 뷰
          </ToggleButton>
          <ToggleButton value="raw">
            <TableViewIcon fontSize="small" sx={{ mr: 1 }} />
            원본 텍스트
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Content Display */}
      {viewMode === 'highlight' && (
        <Fade in timeout={300}>
          <Box>
            {issuesWithHighlight.length > 0 ? (
              <ErrorHighlighter
                text={originalText}
                errors={allIssues}
                onErrorClick={onErrorClick}
                maxHeight={500}
              />
            ) : (
              <Alert severity="success" sx={{ mb: 2 }}>
                오류가 하이라이트된 위치가 없습니다. 모든 오류가 일반적인 규칙 위반입니다.
              </Alert>
            )}
          </Box>
        </Fade>
      )}

      {viewMode === 'marked' && (
        <Fade in timeout={300}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              backgroundColor: '#f9f9f9',
              maxHeight: 500,
              overflow: 'auto',
              border: '1px solid #e0e0e0'
            }}
          >
            {renderMarkedHTML()}
          </Paper>
        </Fade>
      )}

      {viewMode === 'raw' && (
        <Fade in timeout={300}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              backgroundColor: '#f5f5f5',
              maxHeight: 500,
              overflow: 'auto',
              border: '1px solid #e0e0e0'
            }}
          >
            <Typography 
              component="pre" 
              sx={{ 
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {originalText}
            </Typography>
          </Paper>
        </Fade>
      )}

      {/* Statistics */}
      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary">
          총 {originalText.length}자 | 
          하이라이트 가능한 오류: {issuesWithHighlight.length}개 | 
          전체 이슈: {allIssues.length}개
        </Typography>
      </Box>
    </Paper>
  );
};

export default HighlightedTextDisplay;