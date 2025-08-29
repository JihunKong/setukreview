import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  LinearProgress,
  Tooltip,
  styled,
  useTheme,
  Avatar
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  InsertDriveFile as FileIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  School as SchoolIcon,
  Assignment as AssignmentIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material';
import { ValidationResult } from '../../types/validation';

const StyledAccordion = styled(Accordion)(({ theme }) => ({
  background: 'transparent',
  boxShadow: 'none',
  '&:before': {
    display: 'none',
  },
  '& .MuiAccordionSummary-root': {
    backgroundColor: theme.palette.grey[50],
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
    '&:hover': {
      backgroundColor: theme.palette.grey[100],
    },
    '&.Mui-expanded': {
      backgroundColor: theme.palette.primary.light,
      color: theme.palette.primary.contrastText,
    }
  }
}));

const FileListItem = styled(ListItemButton)<{ 
  selected: boolean; 
  statusColor: 'success' | 'warning' | 'error' 
}>(({ theme, selected, statusColor }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(1),
  border: `2px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
  background: selected 
    ? theme.palette.primary.light 
    : theme.palette.background.paper,
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateX(8px)',
    boxShadow: theme.shadows[4],
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: theme.palette[statusColor].main,
    borderTopLeftRadius: theme.shape.borderRadius,
    borderBottomLeftRadius: theme.shape.borderRadius,
  }
}));

interface FileListProps {
  filesByCategory: Record<string, Array<{ fileId: string; result: ValidationResult }>>;
  selectedFileId: string | null;
  onFileSelect: (fileId: string) => void;
}

const FileList: React.FC<FileListProps> = ({
  filesByCategory,
  selectedFileId,
  onFileSelect
}) => {
  const theme = useTheme();
  const [expandedPanels, setExpandedPanels] = useState<string[]>(
    Object.keys(filesByCategory)
  );

  const handleAccordionChange = (panel: string) => (
    event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpandedPanels(prev => 
      isExpanded 
        ? [...prev, panel]
        : prev.filter(p => p !== panel)
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '인적사항':
        return <PersonIcon />;
      case '출결상황':
        return <CalendarIcon />;
      case '창의적체험활동':
        return <SchoolIcon />;
      case '개인세부능력':
        return <AssignmentIcon />;
      case '행동특성및종합의견':
        return <PsychologyIcon />;
      default:
        return <FileIcon />;
    }
  };

  const getCategoryDisplayName = (category: string) => {
    const categoryMap: Record<string, string> = {
      '인적사항': '인적사항',
      '출결상황': '출결상황',
      '창의적체험활동': '창의적체험활동',
      '개인세부능력': '개인세부능력',
      '행동특성및종합의견': '행동특성및종합의견',
      'personal_info': '인적사항',
      'attendance': '출결상황',
      'Unknown': '기타'
    };
    return categoryMap[category] || category;
  };

  const getFileStatus = (result: ValidationResult): {
    color: 'success' | 'warning' | 'error';
    icon: React.ReactNode;
    progress: number;
  } => {
    const errorCount = result.errors?.length || 0;
    const warningCount = result.warnings?.length || 0;
    const totalIssues = errorCount + warningCount;
    const totalCells = result.summary?.totalCells || 1;
    const progress = Math.max(0, ((totalCells - totalIssues) / totalCells) * 100);

    if (errorCount > 0) {
      return {
        color: 'error',
        icon: <ErrorIcon />,
        progress
      };
    } else if (warningCount > 0) {
      return {
        color: 'warning',
        icon: <WarningIcon />,
        progress
      };
    } else {
      return {
        color: 'success',
        icon: <CheckCircleIcon />,
        progress: 100
      };
    }
  };

  const getCategoryStats = (files: Array<{ fileId: string; result: ValidationResult }>) => {
    const totalErrors = files.reduce((sum, { result }) => sum + (result.errors?.length || 0), 0);
    const totalWarnings = files.reduce((sum, { result }) => sum + (result.warnings?.length || 0), 0);
    const totalInfo = files.reduce((sum, { result }) => sum + (result.info?.length || 0), 0);
    
    return { totalErrors, totalWarnings, totalInfo };
  };

  return (
    <Card sx={{ height: 'fit-content', maxHeight: '80vh', overflow: 'hidden' }}>
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileIcon color="primary" />
            검증된 파일 목록
          </Typography>
        </Box>
        
        <Box sx={{ maxHeight: 'calc(80vh - 120px)', overflow: 'auto', p: 2 }}>
          {Object.entries(filesByCategory).map(([category, files]) => {
            const categoryStats = getCategoryStats(files);
            const isExpanded = expandedPanels.includes(category);
            
            return (
              <StyledAccordion
                key={category}
                expanded={isExpanded}
                onChange={handleAccordionChange(category)}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ minHeight: 56 }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    width: '100%',
                    mr: 1
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ 
                        bgcolor: theme.palette.primary.main,
                        width: 32,
                        height: 32
                      }}>
                        {getCategoryIcon(category)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {getCategoryDisplayName(category)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {files.length}개 파일
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {categoryStats.totalErrors > 0 && (
                        <Chip 
                          label={categoryStats.totalErrors}
                          color="error"
                          size="small"
                          icon={<ErrorIcon />}
                        />
                      )}
                      {categoryStats.totalWarnings > 0 && (
                        <Chip 
                          label={categoryStats.totalWarnings}
                          color="warning"
                          size="small"
                          icon={<WarningIcon />}
                        />
                      )}
                      {categoryStats.totalInfo > 0 && (
                        <Chip 
                          label={categoryStats.totalInfo}
                          color="info"
                          size="small"
                          icon={<InfoIcon />}
                        />
                      )}
                    </Box>
                  </Box>
                </AccordionSummary>
                
                <AccordionDetails sx={{ p: 0 }}>
                  <List sx={{ p: 1 }}>
                    {files.map(({ fileId, result }) => {
                      const status = getFileStatus(result);
                      const errorCount = result.errors?.length || 0;
                      const warningCount = result.warnings?.length || 0;
                      const infoCount = result.info?.length || 0;
                      
                      return (
                        <Tooltip 
                          key={fileId}
                          title={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {result.fileName || `File ${fileId}`}
                              </Typography>
                              <Typography variant="caption" display="block">
                                검증 완료: {result.status === 'completed' ? '✓' : '✗'}
                              </Typography>
                              <Typography variant="caption" display="block">
                                성공률: {Math.round(status.progress)}%
                              </Typography>
                            </Box>
                          }
                          placement="top"
                        >
                          <FileListItem
                            selected={selectedFileId === fileId}
                            statusColor={status.color}
                            onClick={() => onFileSelect(fileId)}
                          >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                              <Avatar sx={{ 
                                bgcolor: theme.palette[status.color].light,
                                width: 32,
                                height: 32
                              }}>
                                {status.icon}
                              </Avatar>
                            </ListItemIcon>
                            
                            <ListItemText
                              primary={
                                <Typography variant="body2" sx={{ 
                                  fontWeight: selectedFileId === fileId ? 600 : 400,
                                  fontSize: '0.875rem'
                                }} noWrap>
                                  {result.fileName || `File ${fileId}`}
                                </Typography>
                              }
                              secondary={
                                <Box sx={{ mt: 1 }}>
                                  <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                                    {errorCount > 0 && (
                                      <Chip label={`오류 ${errorCount}`} size="small" color="error" />
                                    )}
                                    {warningCount > 0 && (
                                      <Chip label={`경고 ${warningCount}`} size="small" color="warning" />
                                    )}
                                    {infoCount > 0 && (
                                      <Chip label={`정보 ${infoCount}`} size="small" color="info" />
                                    )}
                                  </Box>
                                  
                                  <LinearProgress 
                                    variant="determinate" 
                                    value={status.progress}
                                    color={status.color}
                                    sx={{ 
                                      height: 4,
                                      borderRadius: 2,
                                      backgroundColor: theme.palette.grey[200]
                                    }}
                                  />
                                </Box>
                              }
                            />
                          </FileListItem>
                        </Tooltip>
                      );
                    })}
                  </List>
                </AccordionDetails>
              </StyledAccordion>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
};

export default FileList;