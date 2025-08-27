import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Divider,
  Badge,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Description as FileIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

export interface FileCategory {
  id: string;
  fileName: string;
  category: string;
  confidence: number;
  uploadedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileSize: number;
  validationId?: string;
  metadata?: {
    sheetCount: number;
    detectedKeywords: string[];
    suggestedAlternatives: string[];
  };
}

export interface CategorySummary {
  [category: string]: {
    count: number;
    files: FileCategory[];
    avgConfidence: number;
    status: 'pending' | 'processing' | 'completed' | 'mixed';
  };
}

interface CategorySidebarProps {
  categories: CategorySummary;
  selectedCategories: string[];
  onCategorySelect: (category: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onValidateSelected: () => void;
  onValidateCategory: (category: string) => void;
  onValidateAll: () => void;
  isValidating: boolean;
  totalFiles: number;
}

const getCategoryDisplayName = (category: string): string => {
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
  };
  return categoryNames[category] || category;
};

const getCategoryIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckIcon color="success" fontSize="small" />;
    case 'failed':
      return <ErrorIcon color="error" fontSize="small" />;
    case 'processing':
      return <PendingIcon color="warning" fontSize="small" />;
    default:
      return <FileIcon color="disabled" fontSize="small" />;
  }
};

const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'processing':
      return 'warning';
    case 'mixed':
      return 'info';
    default:
      return 'default';
  }
};

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  selectedCategories,
  onCategorySelect,
  onSelectAll,
  onDeselectAll,
  onValidateSelected,
  onValidateCategory,
  onValidateAll,
  isValidating,
  totalFiles,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const categoryEntries = Object.entries(categories);
  const hasSelectedCategories = selectedCategories.length > 0;
  const allCategoriesSelected = selectedCategories.length === categoryEntries.length;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatConfidence = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`;
  };

  return (
    <Box sx={{ 
      width: 320, 
      height: '100%', 
      backgroundColor: 'background.paper',
      borderRight: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          📁 파일 분류
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          총 {totalFiles}개 파일 • {categoryEntries.length}개 카테고리
        </Typography>

        {/* Selection Controls */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant={allCategoriesSelected ? "outlined" : "contained"}
            onClick={allCategoriesSelected ? onDeselectAll : onSelectAll}
            disabled={isValidating}
          >
            {allCategoriesSelected ? '전체 해제' : '전체 선택'}
          </Button>
        </Box>
      </Box>

      {/* Category List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List dense sx={{ p: 0 }}>
          {categoryEntries.map(([category, summary]) => {
            const isSelected = selectedCategories.includes(category);
            const isExpanded = expandedCategories.includes(category);

            return (
              <Box key={category}>
                <ListItem
                  sx={{
                    pl: 1,
                    pr: 1,
                    backgroundColor: isSelected ? 'action.selected' : 'transparent',
                  }}
                >
                  <ListItemButton
                    onClick={() => onCategorySelect(category)}
                    sx={{ borderRadius: 1, pl: 1 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getCategoryIcon(summary.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: isSelected ? 600 : 400 }}>
                            {getCategoryDisplayName(category)}
                          </Typography>
                          <Badge
                            badgeContent={summary.count}
                            color="primary"
                            sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 16, height: 16 } }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip
                            label={summary.status === 'mixed' ? '혼합' : summary.status}
                            color={getStatusColor(summary.status)}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.6rem', height: 20 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            신뢰도: {formatConfidence(summary.avgConfidence)}
                          </Typography>
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title={`${category} 카테고리만 검증`}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onValidateCategory(category);
                          }}
                          disabled={isValidating}
                          color="primary"
                        >
                          <PlayIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategoryExpansion(category);
                        }}
                      >
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Box>
                  </ListItemButton>
                </ListItem>

                {/* File List */}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding dense>
                    {summary.files.map((file) => (
                      <ListItem key={file.id} sx={{ pl: 4, pr: 2 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <FileIcon fontSize="small" color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="caption" noWrap title={file.fileName}>
                              {file.fileName}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                              <Typography variant="caption" color="text.secondary">
                                {formatFileSize(file.fileSize)}
                              </Typography>
                              <Chip
                                label={formatConfidence(file.confidence)}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.5rem', height: 16 }}
                              />
                              {getCategoryIcon(file.status)}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>

      <Divider />

      {/* Action Buttons */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<PlayIcon />}
            onClick={onValidateAll}
            disabled={isValidating || totalFiles === 0}
            fullWidth
          >
            전체 검증 ({totalFiles}개)
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onValidateSelected}
            disabled={isValidating || !hasSelectedCategories}
            fullWidth
          >
            선택 검증 ({selectedCategories.length}개 카테고리)
          </Button>
        </Box>

        {hasSelectedCategories && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              선택된 카테고리: {selectedCategories.map(cat => getCategoryDisplayName(cat)).join(', ')}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};