export type Player = 'X' | 'O';
export type CellValue = Player | null;
export type BoardState = CellValue[][];

export interface Position {
  row: number;
  col: number;
}

export interface GameState {
  board: BoardState;
  currentPlayer: Player;
  winner: Player | 'Draw' | null;
  winningLine: Position[] | null;
  isGameOver: boolean;
}
