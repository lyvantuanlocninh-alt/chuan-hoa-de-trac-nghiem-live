import { BoardState, Player, Position } from './types';

export const BOARD_SIZE = 15;
export const WIN_COUNT = 5;

export const createEmptyBoard = (): BoardState => {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
};

export const checkWinner = (board: BoardState, row: number, col: number, player: Player): Position[] | null => {
  const directions = [
    { r: 0, c: 1 },  // Horizontal
    { r: 1, c: 0 },  // Vertical
    { r: 1, c: 1 },  // Diagonal \
    { r: 1, c: -1 }, // Diagonal /
  ];

  for (const { r: dr, c: dc } of directions) {
    let count = 1;
    const line: Position[] = [{ row, col }];

    // Check forward
    for (let i = 1; i < WIN_COUNT; i++) {
      const nr = row + dr * i;
      const nc = col + dc * i;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
        count++;
        line.push({ row: nr, col: nc });
      } else {
        break;
      }
    }

    // Check backward
    for (let i = 1; i < WIN_COUNT; i++) {
      const nr = row - dr * i;
      const nc = col - dc * i;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
        count++;
        line.push({ row: nr, col: nc });
      } else {
        break;
      }
    }

    if (count >= WIN_COUNT) {
      return line;
    }
  }

  return null;
};

export const isBoardFull = (board: BoardState): boolean => {
  return board.every(row => row.every(cell => cell !== null));
};
