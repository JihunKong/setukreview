import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Fade,
  Paper
} from '@mui/material';
import {
  KeyboardArrowUp as PrevIcon,
  KeyboardArrowDown as NextIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { ValidationError } from '../types/validation';

interface ErrorNavigationProps {
  errors: ValidationError[];
  onErrorSelect?: (error: ValidationError, index: number) => void;
  onClose?: () => void;
  visible?: boolean;
}

const ErrorNavigation: React.FC<ErrorNavigationProps> = ({
  errors,
  onErrorSelect,
  onClose,
  visible = true
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Filter errors that have highlight ranges (can be navigated to)
  const navigableErrors = errors.filter(error => error.highlightRange);
  
  useEffect(() => {
    // Reset index when errors change
    if (currentIndex >= navigableErrors.length) {
      setCurrentIndex(0);
    }
  }, [navigableErrors.length, currentIndex]);
  
  const handlePrevious = useCallback(() => {
    if (navigableErrors.length === 0) return;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : navigableErrors.length - 1;
    setCurrentIndex(newIndex);
    onErrorSelect?.(navigableErrors[newIndex], newIndex);
  }, [currentIndex, navigableErrors, onErrorSelect]);
  
  const handleNext = useCallback(() => {
    if (navigableErrors.length === 0) return;
    const newIndex = currentIndex < navigableErrors.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);
    onErrorSelect?.(navigableErrors[newIndex], newIndex);
  }, [currentIndex, navigableErrors, onErrorSelect]);
  
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!visible || navigableErrors.length === 0) return;
    
    // Handle keyboard navigation
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault();
          handlePrevious();
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault();
          handleNext();
          break;
        case 'Escape':
          event.preventDefault();
          onClose?.();
          break;
      }
    }
  }, [visible, navigableErrors.length, handlePrevious, handleNext, onClose]);
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);
  
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <ErrorIcon fontSize="small" color="error" />;
      case 'warning': return <WarningIcon fontSize="small" color="warning" />;
      case 'info': return <InfoIcon fontSize="small" color="info" />;
      default: return null;
    }
  };
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return { bg: '#ffebee', border: '#f44336', text: '#c62828' };
      case 'warning': return { bg: '#fff8e1', border: '#ff9800', text: '#f57c00' };
      case 'info': return { bg: '#e3f2fd', border: '#2196f3', text: '#1976d2' };
      default: return { bg: '#f5f5f5', border: '#ccc', text: '#666' };
    }
  };
  
  if (!visible || navigableErrors.length === 0) {
    return null;
  }
  
  const currentError = navigableErrors[currentIndex];
  const colors = getSeverityColor(currentError?.severity || 'info');
  
  return (
    <Fade in={visible}>
      <Paper
        elevation={4}
        sx={{
          position: 'fixed',
          right: 24,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1300,
          borderRadius: 2,
          overflow: 'hidden',
          minWidth: isExpanded ? 280 : 56,
          transition: 'all 0.3s ease',
          border: `2px solid ${colors.border}`,
          backgroundColor: colors.bg
        }}
      >
        {/* Compact View */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 1
          }}
        >
          {/* Navigation Controls */}
          <Tooltip title="이전 오류 (Ctrl+↑)" placement="left">
            <IconButton
              size="small"
              onClick={handlePrevious}
              disabled={navigableErrors.length <= 1}
              sx={{ color: colors.text }}
            >
              <PrevIcon />
            </IconButton>
          </Tooltip>
          
          {/* Current Error Indicator */}
          <Tooltip 
            title={`오류 ${currentIndex + 1}/${navigableErrors.length}: ${currentError?.message || ''}`}
            placement="left"
          >
            <Box
              onClick={() => setIsExpanded(!isExpanded)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${colors.border}`,
                backgroundColor: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)'
                }
              }}
            >
              {getSeverityIcon(currentError?.severity || 'info')}
            </Box>
          </Tooltip>
          
          <Typography variant="caption" sx={{ color: colors.text, mt: 0.5 }}>
            {currentIndex + 1}/{navigableErrors.length}
          </Typography>
          
          <Tooltip title="다음 오류 (Ctrl+↓)" placement="left">
            <IconButton
              size="small"
              onClick={handleNext}
              disabled={navigableErrors.length <= 1}
              sx={{ color: colors.text }}
            >
              <NextIcon />
            </IconButton>
          </Tooltip>
          
          {onClose && (
            <Tooltip title="닫기 (Esc)" placement="left">
              <IconButton
                size="small"
                onClick={onClose}
                sx={{ color: colors.text, mt: 1 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        
        {/* Expanded View */}
        {isExpanded && currentError && (
          <Box sx={{ p: 2, pt: 0, borderTop: `1px solid ${colors.border}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
              {getSeverityIcon(currentError.severity)}
              <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                {currentError.type.replace('_', ' ')}
              </Typography>
            </Box>
            
            <Typography variant="body2" sx={{ mb: 1, fontSize: '0.8rem' }}>
              {currentError.message}
            </Typography>
            
            <Typography variant="caption" color="text.secondary">
              위치: {currentError.location.cell}
            </Typography>
            
            {currentError.suggestion && (
              <Typography 
                variant="caption" 
                sx={{ 
                  display: 'block', 
                  mt: 1,
                  p: 1,
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  borderRadius: 1,
                  fontSize: '0.75rem'
                }}
              >
                💡 {currentError.suggestion}
              </Typography>
            )}
          </Box>
        )}
        
        {/* Keyboard Shortcuts Hint */}
        {isExpanded && (
          <Box sx={{ 
            p: 1, 
            backgroundColor: 'rgba(0,0,0,0.05)', 
            borderTop: `1px solid ${colors.border}`
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Ctrl+↑↓: 이동 | Esc: 닫기
            </Typography>
          </Box>
        )}
      </Paper>
    </Fade>
  );
};

export default ErrorNavigation;