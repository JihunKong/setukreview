import React, { useState, useCallback } from 'react';
import {
  Box,
  Tooltip,
  Paper,
  Typography,
  Chip,
  IconButton,
  Zoom
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { ValidationError } from '../types/validation';
import ErrorNavigation from './ErrorNavigation';
import '../styles/errorHighlighting.css';

interface ErrorHighlighterProps {
  text: string;
  errors: ValidationError[];
  onErrorClick?: (error: ValidationError) => void;
  showLineNumbers?: boolean;
  maxHeight?: number;
}

interface HighlightedSegment {
  text: string;
  isError: boolean;
  error?: ValidationError;
  startIndex: number;
  endIndex: number;
}

const ErrorHighlighter: React.FC<ErrorHighlighterProps> = ({
  text,
  errors,
  onErrorClick,
  showLineNumbers = false,
  maxHeight = 400
}) => {
  const [hoveredError, setHoveredError] = useState<ValidationError | null>(null);
  const [showNavigation, setShowNavigation] = useState(true);
  const [selectedErrorIndex, setSelectedErrorIndex] = useState(0);

  // Process text and create highlighted segments
  const createHighlightedSegments = useCallback((): HighlightedSegment[] => {
    if (!errors.length) {
      return [{ text, isError: false, startIndex: 0, endIndex: text.length }];
    }

    // Sort errors by start position
    const sortedErrors = errors
      .filter(error => error.highlightRange)
      .sort((a, b) => a.highlightRange!.start - b.highlightRange!.start);

    const segments: HighlightedSegment[] = [];
    let currentIndex = 0;

    for (const error of sortedErrors) {
      if (!error.highlightRange) continue;

      const { start, end } = error.highlightRange;

      // Add text before the error
      if (currentIndex < start) {
        segments.push({
          text: text.substring(currentIndex, start),
          isError: false,
          startIndex: currentIndex,
          endIndex: start
        });
      }

      // Add the error segment
      if (start < text.length && end <= text.length) {
        segments.push({
          text: text.substring(start, end),
          isError: true,
          error: error,
          startIndex: start,
          endIndex: end
        });
        currentIndex = Math.max(currentIndex, end);
      }
    }

    // Add remaining text after the last error
    if (currentIndex < text.length) {
      segments.push({
        text: text.substring(currentIndex),
        isError: false,
        startIndex: currentIndex,
        endIndex: text.length
      });
    }

    return segments;
  }, [text, errors]);

  const getErrorIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <ErrorIcon fontSize="small" color="error" />;
      case 'warning': return <WarningIcon fontSize="small" color="warning" />;
      case 'info': return <InfoIcon fontSize="small" color="info" />;
      default: return <InfoIcon fontSize="small" color="info" />;
    }
  };

  const getHighlightColor = (severity: string) => {
    switch (severity) {
      case 'error': return { 
        backgroundColor: '#ffcdd2', 
        borderColor: '#f44336',
        color: '#c62828'
      };
      case 'warning': return { 
        backgroundColor: '#fff9c4', 
        borderColor: '#ff9800',
        color: '#f57c00'
      };
      case 'info': return { 
        backgroundColor: '#e1f5fe', 
        borderColor: '#2196f3',
        color: '#1976d2'
      };
      default: return { 
        backgroundColor: '#f5f5f5', 
        borderColor: '#ccc',
        color: '#666'
      };
    }
  };

  const renderTooltipContent = (error: ValidationError) => (
    <Box sx={{ maxWidth: 400, p: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        {getErrorIcon(error.severity)}
        <Chip 
          label={error.type.replace('_', ' ')} 
          size="small" 
          sx={{ ml: 1, fontSize: '0.7rem' }}
        />
      </Box>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
        {error.message}
      </Typography>
      {error.suggestion && (
        <Typography variant="body2" color="primary" sx={{ mb: 1 }}>
          <strong>제안:</strong> {error.suggestion}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
        위치: {error.location.sheet}!{error.location.cell}
        {error.confidence && ` (신뢰도: ${Math.round(error.confidence * 100)}%)`}
      </Typography>
    </Box>
  );

  const handleErrorNavigation = useCallback((error: ValidationError, index: number) => {
    setSelectedErrorIndex(index);
    setHoveredError(error);
    onErrorClick?.(error);
  }, [onErrorClick]);

  const segments = createHighlightedSegments();

  return (
    <>
      {/* Error Navigation */}
      <ErrorNavigation
        errors={errors}
        onErrorSelect={handleErrorNavigation}
        onClose={() => setShowNavigation(false)}
        visible={showNavigation && errors.length > 1}
      />
    
      <Paper 
      elevation={1} 
      sx={{ 
        p: 2,
        maxHeight,
        overflow: 'auto',
        fontFamily: 'monospace',
        border: '1px solid #e0e0e0'
      }}
    >
      <Box sx={{ position: 'relative' }}>
        {/* Error count summary */}
        {errors.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              발견된 오류: {errors.length}개
            </Typography>
            {errors.map(error => (
              <Chip
                key={error.id}
                icon={getErrorIcon(error.severity)}
                label={error.severity}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
          </Box>
        )}

        {/* Highlighted text content */}
        <Box sx={{ lineHeight: 1.6, wordBreak: 'break-word' }}>
          {segments.map((segment, index) => (
            segment.isError ? (
              <Tooltip
                key={index}
                title={renderTooltipContent(segment.error!)}
                arrow
                placement="top"
                TransitionComponent={Zoom}
                onOpen={() => setHoveredError(segment.error!)}
                onClose={() => setHoveredError(null)}
              >
                <Box
                  component="mark"
                  sx={{
                    ...getHighlightColor(segment.error!.severity),
                    padding: '2px 4px',
                    borderRadius: '4px',
                    border: `1px solid transparent`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    '&:hover': {
                      transform: 'scale(1.02)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      borderColor: getHighlightColor(segment.error!.severity).borderColor,
                    }
                  }}
                  onClick={() => onErrorClick?.(segment.error!)}
                >
                  {segment.text}
                  {onErrorClick && (
                    <VisibilityIcon 
                      sx={{ 
                        fontSize: 12, 
                        ml: 0.5, 
                        opacity: 0.7,
                        verticalAlign: 'middle' 
                      }} 
                    />
                  )}
                </Box>
              </Tooltip>
            ) : (
              <span key={index}>{segment.text}</span>
            )
          ))}
        </Box>

        {/* Context information when error is hovered */}
        {hoveredError && (hoveredError.contextBefore || hoveredError.contextAfter) && (
          <Box sx={{ 
            mt: 2, 
            p: 1, 
            backgroundColor: '#f9f9f9', 
            borderRadius: 1,
            borderLeft: '4px solid #2196f3'
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              문맥:
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {hoveredError.contextBefore}
              <Box 
                component="span" 
                sx={{ 
                  backgroundColor: getHighlightColor(hoveredError.severity).backgroundColor,
                  padding: '1px 2px',
                  borderRadius: '2px'
                }}
              >
                [{hoveredError.originalText.substring(
                  hoveredError.highlightRange?.start || 0, 
                  hoveredError.highlightRange?.end || hoveredError.originalText.length
                )}]
              </Box>
              {hoveredError.contextAfter}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
    </>
  );
};

export default ErrorHighlighter;