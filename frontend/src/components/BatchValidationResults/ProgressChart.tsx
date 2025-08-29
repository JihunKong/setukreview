import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Grid,
  styled,
  Avatar
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';

const ProgressBar = styled(LinearProgress)(({ theme, color }) => ({
  height: 12,
  borderRadius: 6,
  backgroundColor: theme.palette.grey[200],
  '& .MuiLinearProgress-bar': {
    borderRadius: 6,
  }
}));

const CategoryCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  }
}));

interface ProgressChartProps {
  filesByCategory: Record<string, Array<{ fileId: string; result: any }>>;
}

const ProgressChart: React.FC<ProgressChartProps> = ({ filesByCategory }) => {
  // Calculate overall statistics
  const totalFiles = Object.values(filesByCategory).reduce((sum, files) => sum + files.length, 0);
  const totalErrors = Object.values(filesByCategory)
    .flat()
    .reduce((sum, { result }) => sum + (result.errors?.length || 0), 0);
  const totalWarnings = Object.values(filesByCategory)
    .flat()
    .reduce((sum, { result }) => sum + (result.warnings?.length || 0), 0);
  const totalInfo = Object.values(filesByCategory)
    .flat()
    .reduce((sum, { result }) => sum + (result.info?.length || 0), 0);

  // Calculate category statistics
  const categoryStats = Object.entries(filesByCategory).map(([category, files]) => {
    const errors = files.reduce((sum, { result }) => sum + (result.errors?.length || 0), 0);
    const warnings = files.reduce((sum, { result }) => sum + (result.warnings?.length || 0), 0);
    const info = files.reduce((sum, { result }) => sum + (result.info?.length || 0), 0);
    const totalIssues = errors + warnings;
    const totalCells = files.reduce((sum, { result }) => sum + (result.summary?.totalCells || 1), 0);
    const successRate = totalCells > 0 ? Math.round(((totalCells - totalIssues) / totalCells) * 100) : 0;
    
    return {
      category,
      fileCount: files.length,
      errors,
      warnings,
      info,
      successRate,
      color: errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'success'
    };
  });

  const overallSuccessRate = categoryStats.length > 0 
    ? Math.round(categoryStats.reduce((sum, stat) => sum + stat.successRate, 0) / categoryStats.length)
    : 0;

  return (
    <Box>
      {/* Overall Progress Card */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ backgroundColor: 'rgba(255,255,255,0.2)', mr: 2 }}>
              <AssessmentIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                전체 진행 현황
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {totalFiles}개 파일 검증 완료
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <ProgressBar 
                variant="determinate" 
                value={overallSuccessRate} 
                color="inherit"
                sx={{
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: overallSuccessRate >= 90 ? '#4caf50' : 
                                   overallSuccessRate >= 70 ? '#ff9800' : '#f44336'
                  }
                }}
              />
            </Box>
            <Typography variant="h6" sx={{ ml: 2, fontWeight: 700 }}>
              {overallSuccessRate}%
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {totalFiles}
                </Typography>
                <Typography variant="caption">파일</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#f44336' }}>
                  {totalErrors}
                </Typography>
                <Typography variant="caption">오류</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#ff9800' }}>
                  {totalWarnings}
                </Typography>
                <Typography variant="caption">경고</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2196f3' }}>
                  {totalInfo}
                </Typography>
                <Typography variant="caption">정보</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingUpIcon color="primary" />
        카테고리별 진행 현황
      </Typography>

      <Grid container spacing={2}>
        {categoryStats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={4} key={stat.category}>
            <CategoryCard>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {stat.category}
                  </Typography>
                  <Chip 
                    label={`${stat.fileCount}개`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      성공률
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {stat.successRate}%
                    </Typography>
                  </Box>
                  <ProgressBar 
                    variant="determinate" 
                    value={stat.successRate}
                    color={stat.color as any}
                  />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  {stat.errors > 0 && (
                    <Chip
                      icon={<ErrorIcon />}
                      label={stat.errors}
                      size="small"
                      color="error"
                      variant="outlined"
                    />
                  )}
                  {stat.warnings > 0 && (
                    <Chip
                      icon={<WarningIcon />}
                      label={stat.warnings}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  )}
                  {stat.info > 0 && (
                    <Chip
                      icon={<InfoIcon />}
                      label={stat.info}
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                  )}
                  {stat.errors === 0 && stat.warnings === 0 && (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label="완벽"
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  )}
                </Box>
              </CardContent>
            </CategoryCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ProgressChart;