import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Lightbulb as HintIcon,
  CheckCircle as SolveIcon,
  Timer as TimerIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

type SudokuCell = {
  value: number | null;
  isGiven: boolean;
  isValid: boolean;
};

type SudokuGrid = SudokuCell[][];

interface SudokuGameProps {
  onClose?: () => void;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export const SudokuGame: React.FC<SudokuGameProps> = ({ 
  onClose, 
  difficulty = 'medium' 
}) => {
  const [grid, setGrid] = useState<SudokuGrid>([]);
  const [solution, setSolution] = useState<number[][]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{row: number; col: number} | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintCell, setHintCell] = useState<{row: number; col: number} | null>(null);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && !isComplete) {
      interval = setInterval(() => {
        setTime(time => time + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isComplete]);

  // Generate a complete valid Sudoku solution
  const generateSolution = useCallback((): number[][] => {
    const grid: number[][] = Array(9).fill(null).map(() => Array(9).fill(0));
    
    const isValid = (grid: number[][], row: number, col: number, num: number): boolean => {
      // Check row
      for (let x = 0; x < 9; x++) {
        if (grid[row][x] === num) return false;
      }
      
      // Check column
      for (let x = 0; x < 9; x++) {
        if (grid[x][col] === num) return false;
      }
      
      // Check 3x3 box
      const startRow = Math.floor(row / 3) * 3;
      const startCol = Math.floor(col / 3) * 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (grid[startRow + i][startCol + j] === num) return false;
        }
      }
      
      return true;
    };

    const solveSudoku = (grid: number[][]): boolean => {
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          if (grid[i][j] === 0) {
            const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            // Shuffle numbers for randomness
            for (let k = numbers.length - 1; k > 0; k--) {
              const randomIndex = Math.floor(Math.random() * (k + 1));
              [numbers[k], numbers[randomIndex]] = [numbers[randomIndex], numbers[k]];
            }
            
            for (const num of numbers) {
              if (isValid(grid, i, j, num)) {
                grid[i][j] = num;
                if (solveSudoku(grid)) {
                  return true;
                }
                grid[i][j] = 0;
              }
            }
            return false;
          }
        }
      }
      return true;
    };

    solveSudoku(grid);
    return grid;
  }, []);

  // Create puzzle by removing cells from complete solution
  const createPuzzle = useCallback((solution: number[][], difficulty: string): SudokuGrid => {
    const puzzle: SudokuGrid = solution.map(row =>
      row.map(value => ({
        value,
        isGiven: true,
        isValid: true,
      }))
    );

    // Remove cells based on difficulty
    const cellsToRemove = {
      easy: 35,
      medium: 45,
      hard: 55,
    }[difficulty] || 45;

    const positions = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        positions.push([i, j]);
      }
    }

    // Shuffle positions
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Remove cells
    for (let i = 0; i < cellsToRemove && i < positions.length; i++) {
      const [row, col] = positions[i];
      puzzle[row][col] = {
        value: null,
        isGiven: false,
        isValid: true,
      };
    }

    return puzzle;
  }, []);

  // Initialize game
  const initializeGame = useCallback(() => {
    const newSolution = generateSolution();
    const newGrid = createPuzzle(newSolution, difficulty);
    
    setSolution(newSolution);
    setGrid(newGrid);
    setIsComplete(false);
    setTime(0);
    setIsRunning(true);
    setSelectedCell(null);
    setHintCell(null);
    setShowHint(false);
  }, [generateSolution, createPuzzle, difficulty]);

  // Initialize on mount
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Validate cell value
  const isValidMove = (grid: SudokuGrid, row: number, col: number, value: number): boolean => {
    // Check row
    for (let x = 0; x < 9; x++) {
      if (x !== col && grid[row][x].value === value) return false;
    }
    
    // Check column
    for (let x = 0; x < 9; x++) {
      if (x !== row && grid[x][col].value === value) return false;
    }
    
    // Check 3x3 box
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const currentRow = startRow + i;
        const currentCol = startCol + j;
        if ((currentRow !== row || currentCol !== col) && 
            grid[currentRow][currentCol].value === value) {
          return false;
        }
      }
    }
    
    return true;
  };

  // Handle cell input
  const handleCellChange = (row: number, col: number, value: string) => {
    if (grid[row][col].isGiven) return;
    
    const numValue = value === '' ? null : parseInt(value);
    
    if (numValue && (numValue < 1 || numValue > 9)) return;

    const newGrid = [...grid];
    newGrid[row][col] = {
      ...newGrid[row][col],
      value: numValue,
      isValid: numValue ? isValidMove(newGrid, row, col, numValue) : true,
    };
    
    setGrid(newGrid);
    
    // Check if puzzle is complete
    const isComplete = newGrid.every(row =>
      row.every(cell => cell.value !== null && cell.isValid)
    );
    
    if (isComplete) {
      setIsComplete(true);
      setIsRunning(false);
    }
  };

  // Get hint
  const showHintForCell = () => {
    const emptyCells = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (!grid[i][j].isGiven && grid[i][j].value === null) {
          emptyCells.push([i, j]);
        }
      }
    }
    
    if (emptyCells.length > 0) {
      const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      const [row, col] = randomCell;
      setHintCell({ row, col });
      setShowHint(true);
    }
  };

  // Apply hint
  const applyHint = () => {
    if (hintCell) {
      const { row, col } = hintCell;
      const correctValue = solution[row][col];
      handleCellChange(row, col, correctValue.toString());
      setShowHint(false);
      setHintCell(null);
    }
  };

  // Solve puzzle
  const solvePuzzle = () => {
    const newGrid = grid.map((row, i) =>
      row.map((cell, j) => ({
        ...cell,
        value: solution[i][j],
        isValid: true,
      }))
    );
    setGrid(newGrid);
    setIsComplete(true);
    setIsRunning(false);
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get cell style
  const getCellStyle = (row: number, col: number, cell: SudokuCell) => {
    const isSelected = selectedCell?.row === row && selectedCell?.col === col;
    const isHintCell = hintCell?.row === row && hintCell?.col === col;
    
    return {
      width: 40,
      height: 40,
      '& .MuiOutlinedInput-root': {
        height: 40,
        '& input': {
          textAlign: 'center',
          padding: 0,
          fontSize: '1.1rem',
          fontWeight: cell.isGiven ? 'bold' : 'normal',
          color: cell.isGiven 
            ? 'text.primary' 
            : cell.isValid 
              ? 'primary.main' 
              : 'error.main',
        },
        '& fieldset': {
          borderColor: isSelected 
            ? 'primary.main' 
            : isHintCell 
              ? 'warning.main'
              : cell.isValid 
                ? 'grey.300' 
                : 'error.main',
          borderWidth: isSelected || isHintCell ? 2 : 1,
        },
        backgroundColor: cell.isGiven 
          ? 'grey.100' 
          : isHintCell 
            ? 'warning.light'
            : isSelected 
              ? 'action.selected' 
              : 'background.paper',
      }
    };
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          🧩 스도쿠 게임
        </Typography>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      {/* Game Info */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip 
            icon={<TimerIcon />} 
            label={formatTime(time)} 
            variant="outlined" 
            color="primary"
          />
          <Chip 
            label={difficulty.toUpperCase()} 
            color="secondary" 
            size="small"
          />
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="힌트 보기">
            <IconButton onClick={showHintForCell} color="primary" size="small">
              <HintIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="자동 해결">
            <IconButton onClick={solvePuzzle} color="secondary" size="small">
              <SolveIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="새 게임">
            <IconButton onClick={initializeGame} color="primary" size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Sudoku Grid */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <Grid container spacing={0} sx={{ width: 'fit-content' }}>
          {grid.map((row, i) => (
            <Grid container item xs={12} key={i} spacing={0}>
              {row.map((cell, j) => (
                <Grid item key={`${i}-${j}`}>
                  <Box
                    sx={{
                      p: 0.25,
                      borderRight: (j + 1) % 3 === 0 && j < 8 ? '2px solid' : 'none',
                      borderBottom: (i + 1) % 3 === 0 && i < 8 ? '2px solid' : 'none',
                      borderColor: 'grey.800',
                    }}
                  >
                    <TextField
                      size="small"
                      value={cell.value || ''}
                      onChange={(e) => handleCellChange(i, j, e.target.value)}
                      onClick={() => setSelectedCell({ row: i, col: j })}
                      disabled={cell.isGiven}
                      inputProps={{
                        maxLength: 1,
                        style: { textAlign: 'center' }
                      }}
                      sx={getCellStyle(i, j, cell)}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Game Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
        <Button
          variant="outlined"
          onClick={initializeGame}
          startIcon={<RefreshIcon />}
        >
          새 게임
        </Button>
      </Box>

      {/* Completion Alert */}
      {isComplete && (
        <Alert severity="success" sx={{ mt: 2 }}>
          🎉 축하합니다! {formatTime(time)}에 완료했습니다!
        </Alert>
      )}

      {/* Hint Dialog */}
      <Dialog open={showHint} onClose={() => setShowHint(false)}>
        <DialogTitle>💡 힌트</DialogTitle>
        <DialogContent>
          <Typography>
            {hintCell && `행 ${hintCell.row + 1}, 열 ${hintCell.col + 1}의 정답은 ${solution[hintCell.row][hintCell.col]}입니다.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHint(false)}>취소</Button>
          <Button onClick={applyHint} variant="contained">적용하기</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};