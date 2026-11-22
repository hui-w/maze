/**
 * @author Wang, Hui (huiwang@qlike.com)
 * @repo https://github.com/hui-w/maze
 * @licence MIT
 */
const MazeConfig = {
  Game: {
    keyboardTimerDelay: 200,
    dragThreshold: 12,
    defaultSize: "XS",
    defaultAnimationDelay: "FAST",
  },
  GridSize: { XXS: 8, XS: 16, S: 24, M: 32, L: 48, XL: 64 },
  AnimationDelay: {
    MazeGeneration: {
      OFF: 0,
      SLOW: 64,
      NORMAL: 32,
      FAST: 8,
    },
    PathFinding: {
      OFF: 0,
      SLOW: 256,
      NORMAL: 128,
      FAST: 8,
    },
  },
  Maze: {
    wallColor: "#0B4F33",
    highlightedWallColor: "#D94530",
    highlightedCellColor: "RGBA(255,182,8,0.35)",
  },
  Path: {
    pathColor: "RGBA(255,182,8,0.65)",
    entranceColor: "#D94530",
    exitColor: "#009C58",
    stepColor: "#FFB608",
    openAreaColor: "RGBA(255,182,8,0.4)",
    closeAreaColor: "RGBA(0,156,88,0.15)",
  },
};
