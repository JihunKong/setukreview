import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  CircularProgress,
  useTheme,
  styled,
  Fade,
  Grow
} from '@mui/material';
import {
  Folder as FolderIcon,
  TableChart as TableChartIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

// Styled components with gradients
const GradientCard = styled(Card)<{ gradient: string }>(({ theme, gradient }) => ({
  background: gradient,
  color: theme.palette.common.white,
  transition: 'all 0.3s ease-in-out',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    '&::before': {
      opacity: 0.1,
    }
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: theme.palette.common.white,
    opacity: 0,
    transition: 'opacity 0.3s ease',
  }
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 48,
  height: 48,
  borderRadius: '50%',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  marginBottom: theme.spacing(2),
}));

const CountUpNumber = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '2.5rem',
  lineHeight: 1,
  textShadow: '0 2px 4px rgba(0,0,0,0.1)',
}));

interface SummaryCardsProps {
  stats: {
    totalFiles: number;
    totalCells: number;
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
  };
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ stats }) => {
  const theme = useTheme();
  
  // Calculate success rate
  const totalIssues = stats.totalErrors + stats.totalWarnings;
  const successRate = stats.totalCells > 0 ? Math.round(((stats.totalCells - totalIssues) / stats.totalCells) * 100) : 0;

  const cardData = [
    {
      title: '총 파일 수',
      value: stats.totalFiles,
      icon: <FolderIcon />,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: theme.palette.primary.main,
      delay: 0
    },
    {
      title: '검사한 셀',
      value: stats.totalCells.toLocaleString(),
      icon: <TableChartIcon />,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      color: theme.palette.info.main,
      delay: 100
    },
    {
      title: '오류',
      value: stats.totalErrors,
      icon: <ErrorIcon />,
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      color: theme.palette.error.main,
      delay: 200
    },
    {
      title: '경고',
      value: stats.totalWarnings,
      icon: <WarningIcon />,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      color: theme.palette.warning.main,
      delay: 300
    },
    {
      title: '정보',
      value: stats.totalInfo,
      icon: <InfoIcon />,
      gradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
      color: theme.palette.success.main,
      delay: 400
    }
  ];

  return (
    <Box sx={{ mb: 4 }}>
      {/* Title with success rate indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'text.primary' }}>
          일괄 검증 결과
        </Typography>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress
            variant="determinate"
            value={successRate}
            size={60}
            thickness={4}
            sx={{
              color: successRate >= 90 ? theme.palette.success.main : 
                     successRate >= 70 ? theme.palette.warning.main : 
                     theme.palette.error.main,
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }}
          />
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
              {successRate}%
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Summary Cards Grid */}
      <Grid container spacing={3}>
        {cardData.map((card, index) => (
          <Grid item xs={12} sm={6} md={2.4} key={card.title}>
            <Grow
              in={true}
              timeout={1000 + card.delay}
            >
              <GradientCard gradient={card.gradient}>
                <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                  <IconWrapper>
                    {card.icon}
                  </IconWrapper>
                  
                  <CountUpNumber variant="h4">
                    {typeof card.value === 'string' ? card.value : card.value.toLocaleString()}
                  </CountUpNumber>
                  
                  <Typography variant="body2" sx={{ 
                    opacity: 0.9,
                    fontWeight: 500,
                    mt: 1
                  }}>
                    {card.title}
                  </Typography>
                  
                  {/* Status indicator */}
                  {card.title === '오류' && stats.totalErrors === 0 && (
                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CheckCircleIcon sx={{ fontSize: 16 }} />
                      <Typography variant="caption">완벽!</Typography>
                    </Box>
                  )}
                </CardContent>
              </GradientCard>
            </Grow>
          </Grid>
        ))}
      </Grid>
      
      {/* Additional Success Metrics */}
      <Fade in={true} timeout={2000}>
        <Box sx={{ 
          mt: 3, 
          p: 3, 
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          borderRadius: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
              전체 성공률: {successRate}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {stats.totalCells > 0 ? `${(stats.totalCells - totalIssues).toLocaleString()}개 셀이 정상` : '검증 대기 중'}
            </Typography>
          </Box>
          
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" color="text.secondary">
              총 검증 이슈
            </Typography>
            <Typography variant="h6" sx={{ 
              fontWeight: 600,
              color: totalIssues > 0 ? theme.palette.warning.main : theme.palette.success.main
            }}>
              {totalIssues.toLocaleString()}개
            </Typography>
          </Box>
        </Box>
      </Fade>
    </Box>
  );
};

export default SummaryCards;