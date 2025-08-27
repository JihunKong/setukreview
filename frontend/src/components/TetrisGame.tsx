import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  KeyboardArrowDown as DropIcon,
} from '@mui/icons-material';

interface TetrisGameProps {
  onClose?: () => void;
}

// Tetris piece shapes
const TETRIS_PIECES = {
  I: [
    [1, 1, 1, 1]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1]
  ]
};

const PIECE_COLORS = {
  I: '#00f5ff',
  O: '#ffff00',
  T: '#a000f0',
  S: '#00ff00',
  Z: '#ff0000',
  J: '#0000ff',
  L: '#ff8000'
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const EMPTY_CELL = 0;

type PieceType = keyof typeof TETRIS_PIECES;
type GameBoard = number[][];

interface Piece {
  type: PieceType;
  x: number;
  y: number;
  rotation: number;
}

export const TetrisGame: React.FC<TetrisGameProps> = ({ onClose }) => {
  const [board, setBoard] = useState<GameBoard>([]);
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<PieceType | null>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [dropTime, setDropTime] = useState(1000);
  
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const lastDropTimeRef = useRef<number>(0);

  // Initialize empty board
  const createEmptyBoard = (): GameBoard => 
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(EMPTY_CELL));

  // Get random piece type
  const getRandomPieceType = (): PieceType => {
    const pieces = Object.keys(TETRIS_PIECES) as PieceType[];
    return pieces[Math.floor(Math.random() * pieces.length)];
  };

  // Create new piece
  const createPiece = (type: PieceType): Piece => ({
    type,
    x: Math.floor(BOARD_WIDTH / 2) - 1,
    y: 0,
    rotation: 0
  });

  // Rotate piece shape
  const rotatePiece = (shape: number[][]): number[][] => {
    const rotated = shape[0].map((_, index) =>
      shape.map(row => row[index]).reverse()
    );
    return rotated;
  };

  // Get piece shape with rotation
  const getPieceShape = (piece: Piece): number[][] => {
    let shape = TETRIS_PIECES[piece.type];
    for (let i = 0; i < piece.rotation; i++) {
      shape = rotatePiece(shape);
    }
    return shape;
  };

  // Check if piece can be placed
  const isValidMove = (board: GameBoard, piece: Piece, dx = 0, dy = 0, rotation = 0): boolean => {
    const testPiece = { ...piece, x: piece.x + dx, y: piece.y + dy, rotation: (piece.rotation + rotation) % 4 };
    const shape = getPieceShape(testPiece);

    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const newX = testPiece.x + x;
          const newY = testPiece.y + y;

          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
            return false;
          }

          if (newY >= 0 && board[newY][newX] !== EMPTY_CELL) {
            return false;
          }
        }
      }
    }

    return true;
  };

  // Place piece on board
  const placePiece = (board: GameBoard, piece: Piece): GameBoard => {
    const newBoard = board.map(row => [...row]);
    const shape = getPieceShape(piece);
    const color = Object.keys(PIECE_COLORS).indexOf(piece.type) + 1;

    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const boardX = piece.x + x;
          const boardY = piece.y + y;
          if (boardY >= 0) {
            newBoard[boardY][boardX] = color;
          }
        }
      }
    }

    return newBoard;
  };

  // Clear completed lines
  const clearLines = (board: GameBoard): { newBoard: GameBoard; linesCleared: number } => {
    const fullLines: number[] = [];
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      if (board[y].every(cell => cell !== EMPTY_CELL)) {
        fullLines.push(y);
      }
    }

    if (fullLines.length === 0) {
      return { newBoard: board, linesCleared: 0 };
    }

    const newBoard = board.filter((_, index) => !fullLines.includes(index));
    const emptyLines = Array(fullLines.length).fill(null).map(() => Array(BOARD_WIDTH).fill(EMPTY_CELL));
    
    return { newBoard: [...emptyLines, ...newBoard], linesCleared: fullLines.length };
  };

  // Initialize game
  const initializeGame = useCallback(() => {
    const newBoard = createEmptyBoard();
    const firstPiece = createPiece(getRandomPieceType());
    const nextPieceType = getRandomPieceType();

    setBoard(newBoard);
    setCurrentPiece(firstPiece);
    setNextPiece(nextPieceType);
    setScore(0);
    setLines(0);
    setLevel(1);
    setIsGameOver(false);
    setDropTime(1000);
  }, []);

  // Move piece
  const movePiece = useCallback((dx: number, dy: number) => {
    if (!currentPiece || isGameOver || !isPlaying) return;

    if (isValidMove(board, currentPiece, dx, dy)) {
      setCurrentPiece(prev => prev ? { ...prev, x: prev.x + dx, y: prev.y + dy } : null);
    } else if (dy > 0) {
      // Piece can't move down, place it
      const newBoard = placePiece(board, currentPiece);
      const { newBoard: clearedBoard, linesCleared } = clearLines(newBoard);
      
      setBoard(clearedBoard);
      setLines(prev => prev + linesCleared);
      setScore(prev => prev + (linesCleared * 100 * level) + (level * 10));
      
      // Check for level up
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel !== level) {
        setLevel(newLevel);
        setDropTime(Math.max(100, 1000 - (newLevel * 50)));
      }

      // Create next piece
      if (nextPiece) {
        const newPiece = createPiece(nextPiece);
        if (isValidMove(clearedBoard, newPiece)) {
          setCurrentPiece(newPiece);
          setNextPiece(getRandomPieceType());
        } else {
          // Game over
          setIsGameOver(true);
          setIsPlaying(false);
        }
      }
    }
  }, [board, currentPiece, isGameOver, isPlaying, level, lines, nextPiece]);

  // Rotate piece
  const rotatePieceHandler = useCallback(() => {
    if (!currentPiece || isGameOver || !isPlaying) return;

    if (isValidMove(board, currentPiece, 0, 0, 1)) {
      setCurrentPiece(prev => prev ? { ...prev, rotation: (prev.rotation + 1) % 4 } : null);
    }
  }, [board, currentPiece, isGameOver, isPlaying]);

  // Hard drop
  const hardDrop = useCallback(() => {
    if (!currentPiece || isGameOver || !isPlaying) return;

    let dropDistance = 0;
    while (isValidMove(board, currentPiece, 0, dropDistance + 1)) {
      dropDistance++;
    }
    
    if (dropDistance > 0) {
      movePiece(0, dropDistance);
      setScore(prev => prev + dropDistance * 2);
    }
  }, [board, currentPiece, isGameOver, isPlaying, movePiece]);

  // Game loop
  useEffect(() => {
    if (isPlaying && !isGameOver) {
      const gameLoop = () => {
        const now = Date.now();
        if (now - lastDropTimeRef.current > dropTime) {
          movePiece(0, 1);
          lastDropTimeRef.current = now;
        }
      };

      gameLoopRef.current = setInterval(gameLoop, 50);
    } else if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [isPlaying, isGameOver, dropTime, movePiece]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!isPlaying || isGameOver) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          movePiece(-1, 0);
          break;
        case 'ArrowRight':
          event.preventDefault();
          movePiece(1, 0);
          break;
        case 'ArrowDown':
          event.preventDefault();
          movePiece(0, 1);
          break;
        case 'ArrowUp':
        case ' ':
          event.preventDefault();
          rotatePieceHandler();
          break;
        case 'Enter':
          event.preventDefault();
          hardDrop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, isGameOver, movePiece, rotatePieceHandler, hardDrop]);

  // Initialize on mount
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Render board with current piece
  const renderBoard = () => {
    let displayBoard = board.map(row => [...row]);

    // Add current piece to display board
    if (currentPiece) {
      const shape = getPieceShape(currentPiece);
      const color = Object.keys(PIECE_COLORS).indexOf(currentPiece.type) + 1;

      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
          if (shape[y][x]) {
            const boardX = currentPiece.x + x;
            const boardY = currentPiece.y + y;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = color;
            }
          }
        }
      }
    }

    return displayBoard;
  };

  // Get cell color
  const getCellColor = (value: number): string => {
    if (value === EMPTY_CELL) return '#1a1a1a';
    const colors = Object.values(PIECE_COLORS);
    return colors[value - 1] || '#666666';
  };

  // Render next piece
  const renderNextPiece = () => {
    if (!nextPiece) return null;

    const shape = TETRIS_PIECES[nextPiece];
    const color = PIECE_COLORS[nextPiece];

    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(4, 1fr)`, gap: 0.25, p: 1 }}>
        {Array(4).fill(null).map((_, y) =>
          Array(4).fill(null).map((_, x) => {
            const hasBlock = y < shape.length && x < shape[y].length && shape[y][x];
            return (
              <Box
                key={`${y}-${x}`}
                sx={{
                  width: 20,
                  height: 20,
                  backgroundColor: hasBlock ? color : 'transparent',
                  border: hasBlock ? '1px solid #333' : 'none',
                }}
              />
            );
          })
        )}
      </Box>
    );
  };

  const startGame = () => {
    setIsPlaying(true);
    lastDropTimeRef.current = Date.now();
  };

  const pauseGame = () => {
    setIsPlaying(false);
  };

  const resetGame = () => {
    setIsPlaying(false);
    initializeGame();
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          🧱 테트리스 게임
        </Typography>
        {onClose && (
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Game Board */}
        <Grid item xs={12} md={8}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Board */}
            <Box 
              sx={{ 
                display: 'grid',
                gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
                gap: '1px',
                backgroundColor: '#333',
                border: '2px solid #666',
                p: 0.5,
              }}
            >
              {renderBoard().map((row, y) =>
                row.map((cell, x) => (
                  <Box
                    key={`${y}-${x}`}
                    sx={{
                      width: 25,
                      height: 25,
                      backgroundColor: getCellColor(cell),
                      border: cell !== EMPTY_CELL ? '1px solid #333' : 'none',
                    }}
                  />
                ))
              )}
            </Box>

            {/* Controls */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              {!isPlaying ? (
                <Button
                  variant="contained"
                  onClick={startGame}
                  startIcon={<PlayIcon />}
                  disabled={isGameOver}
                >
                  {isGameOver ? '게임 종료' : '시작'}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  onClick={pauseGame}
                  startIcon={<PauseIcon />}
                >
                  일시정지
                </Button>
              )}
              
              <Button
                variant="outlined"
                onClick={resetGame}
                startIcon={<RefreshIcon />}
              >
                새 게임
              </Button>

              {isPlaying && (
                <Tooltip title="하드 드롭 (Enter)">
                  <Button
                    variant="outlined"
                    onClick={hardDrop}
                    startIcon={<DropIcon />}
                  >
                    드롭
                  </Button>
                </Tooltip>
              )}
            </Box>

            {/* Game Over */}
            {isGameOver && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                🎮 게임이 종료되었습니다! 최종 점수: {score.toLocaleString()}점
              </Alert>
            )}
          </Box>
        </Grid>

        {/* Side Panel */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Score Info */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                📊 게임 정보
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Chip label={`점수: ${score.toLocaleString()}`} color="primary" />
                <Chip label={`줄: ${lines}`} color="secondary" />
                <Chip label={`레벨: ${level}`} color="info" />
              </Box>
            </Paper>

            {/* Next Piece */}
            {nextPiece && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  🔮 다음 블록
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {renderNextPiece()}
                </Box>
              </Paper>
            )}

            {/* Controls Help */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                🎮 조작법
              </Typography>
              <Typography variant="body2" component="div">
                • ← → : 좌우 이동<br />
                • ↓ : 빠른 낙하<br />
                • ↑ / 스페이스 : 회전<br />
                • Enter : 하드 드롭
              </Typography>
            </Paper>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};