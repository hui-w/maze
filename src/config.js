/**
 * @author Wang, Hui (huiwang@qlike.com)
 * @repo https://github.com/hui-w/maze
 * @licence MIT
 */
var Config = {
  Game: {
    padding: 12,
    backgroundColor: "#FFFDF7",
    keyboardTimerDelay: 200,
    dragThreshold: 12,
    defaultSize: "XS",
    defaultAnimationDelay: "FAST",
  },
  // Maze size options: label -> cells per side
  MazeSize: { XXS: 8, XS: 16, S: 24, M: 32, L: 48, XL: 64 },
  AnimationDelay: {
    MazeGeneration: {
      OFF: 0,
      FAST: 8,
      NORMAL: 32,
      SLOW: 64,
    },
    PathFinding: {
      OFF: 0,
      FAST: 8,
      NORMAL: 128,
      SLOW: 256,
    },
  },
  Maze: {
    rows: 16,
    cols: 16,
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
