import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  Fade,
  Collapse,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Games as GamesIcon,
  Extension as PuzzleIcon,
  SportsEsports as TetrisIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { SudokuGame } from './SudokuGame';
import { TetrisGame } from './TetrisGame';

interface WaitingEntertainmentProps {
  progress: number;
  estimatedTimeRemaining?: number;
  currentTask?: string;
  totalFiles: number;
  completedFiles: number;
  onClose?: () => void;
}

type GameType = 'sudoku' | 'tetris' | null;

export const WaitingEntertainment: React.FC<WaitingEntertainmentProps> = ({
  progress,
  estimatedTimeRemaining,
  currentTask,
  totalFiles,
  completedFiles,
  onClose,
}) => {
  const [selectedGame, setSelectedGame] = useState<GameType>(null);
  const [showGames, setShowGames] = useState(false);
  const [sudokuDifficulty, setSudokuDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}초`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}분 ${remainingSeconds}초`;
  };

  const getProgressMessage = (): string => {
    if (progress === 0) {
      return '검증을 시작하는 중...';
    } else if (progress < 25) {
      return '파일을 분석하는 중...';
    } else if (progress < 50) {
      return '내용을 검증하는 중...';
    } else if (progress < 75) {
      return '중복을 검사하는 중...';
    } else if (progress < 100) {
      return '결과를 정리하는 중...';
    } else {
      return '검증이 완료되었습니다!';
    }
  };

  const selectGame = (game: GameType) => {
    setSelectedGame(game);
    setShowGames(true);
  };

  const closeGame = () => {
    setSelectedGame(null);
    setShowGames(false);
  };

  const renderGameSelection = () => (
    <Fade in={!showGames}>
      <Box>
        <Typography variant="h6" gutterBottom align="center" sx={{ mb: 3 }}>
          🎮 기다리는 동안 게임을 즐겨보세요!
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                }
              }}
              onClick={() => selectGame('sudoku')}
            >
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <PuzzleIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  스도쿠
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  숫자 퍼즐로 두뇌를 활성화하세요
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
                  <Chip 
                    label="쉬움" 
                    size="small" 
                    color={sudokuDifficulty === 'easy' ? 'primary' : 'default'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSudokuDifficulty('easy');
                    }}
                  />
                  <Chip 
                    label="보통" 
                    size="small" 
                    color={sudokuDifficulty === 'medium' ? 'primary' : 'default'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSudokuDifficulty('medium');
                    }}
                  />
                  <Chip 
                    label="어려움" 
                    size="small" 
                    color={sudokuDifficulty === 'hard' ? 'primary' : 'default'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSudokuDifficulty('hard');
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                }
              }}
              onClick={() => selectGame('tetris')}
            >
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <TetrisIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  테트리스
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  클래식 블록 쌓기 게임을 즐겨보세요
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Chip label="키보드 조작" size="small" variant="outlined" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            💡 <strong>팁:</strong> 게임은 검증이 완료될 때까지 언제든지 즐기실 수 있습니다. 
            검증이 완료되면 자동으로 알림을 드립니다.
          </Typography>
        </Alert>
      </Box>
    </Fade>
  );

  const renderSelectedGame = () => {
    if (!selectedGame) return null;

    return (
      <Fade in={showGames}>
        <Box>
          {selectedGame === 'sudoku' && (
            <SudokuGame 
              onClose={closeGame} 
              difficulty={sudokuDifficulty}
            />
          )}
          {selectedGame === 'tetris' && (
            <TetrisGame onClose={closeGame} />
          )}
        </Box>
      </Fade>
    );
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* Progress Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom align="center">
          📊 검증 진행 상황
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body1">
              {getProgressMessage()}
            </Typography>
            <Typography variant="body2" color="primary.main" fontWeight="medium">
              {progress}%
            </Typography>
          </Box>
          
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                진행 상황
              </Typography>
              <Typography variant="h6">
                {completedFiles} / {totalFiles}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                파일 처리됨
              </Typography>
            </Box>
          </Grid>

          {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
            <Grid item xs={12} sm={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  예상 남은 시간
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <TimerIcon fontSize="small" />
                  <Typography variant="h6">
                    {formatTime(estimatedTimeRemaining)}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}

          {currentTask && (
            <Grid item xs={12} sm={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  현재 작업
                </Typography>
                <Typography variant="body1" noWrap title={currentTask}>
                  {currentTask}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Games Section */}
      <Paper elevation={2} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GamesIcon color="primary" />
            <Typography variant="h6">
              엔터테인먼트
            </Typography>
          </Box>
          
          {showGames && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={closeGame}
                size="small"
              >
                게임 선택으로 돌아가기
              </Button>
              
              <IconButton onClick={() => setShowGames(!showGames)}>
                {showGames ? <CollapseIcon /> : <ExpandIcon />}
              </IconButton>
            </Box>
          )}
        </Box>

        <Collapse in={!showGames || selectedGame === null}>
          {renderGameSelection()}
        </Collapse>

        <Collapse in={showGames && selectedGame !== null}>
          {renderSelectedGame()}
        </Collapse>
      </Paper>

      {progress >= 100 && (
        <Fade in={true}>
          <Alert severity="success" sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              🎉 검증이 완료되었습니다!
            </Typography>
            <Typography variant="body2">
              결과를 확인해보세요. 게임을 계속 즐기시거나 결과 페이지로 이동하실 수 있습니다.
            </Typography>
          </Alert>
        </Fade>
      )}
    </Box>
  );
};