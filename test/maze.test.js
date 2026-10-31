const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/* the sources are browser scripts; load them into one context with minimal browser stubs */
function load() {
  const context = vm.createContext({
    CanvasRenderingContext2D: { prototype: {} },
    Element: { prototype: {} },
    document: {},
  });
  context.window = context;
  ["common.js", "config.js", "maze.js", "path.js"].forEach(function (file) {
    const code = fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
    vm.runInContext(code, context, { filename: file });
  });
  vm.runInContext("Config.Maze.showStep = false; Config.Path.showStep = false;", context);
  return context;
}

const ctx = load();
const sizes = [
  [8, 8],
  [4, 8],
  [8, 4],
  [6, 6],
  [16, 16],
  [32, 32],
];

function generate(rows, cols) {
  const maze = new ctx.Maze(rows, cols);
  maze.init();
  return maze;
}

function connectedCellCount(maze) {
  const seen = new Set([0]);
  const queue = [maze.cells[0]];
  while (queue.length) {
    const cell = queue.pop();
    cell.walls.forEach(function (wall) {
      if (!wall.isOpen) {
        return;
      }
      const other = wall.getOtherCell(cell);
      const index = other.row * maze.cols + other.col;
      if (!seen.has(index)) {
        seen.add(index);
        queue.push(other);
      }
    });
  }
  return seen.size;
}

sizes.forEach(function (size) {
  const rows = size[0];
  const cols = size[1];

  test("maze " + rows + "x" + cols + " is a perfect maze", function () {
    const maze = generate(rows, cols);
    assert.strictEqual(maze.cells.length, rows * cols);

    //cell index is row * cols + col
    maze.cells.forEach(function (cell, i) {
      assert.strictEqual(cell.row * cols + cell.col, i);
    });

    //every cell is reachable, and with n - 1 open walls there is no loop
    const openWalls = maze.walls.filter(function (wall) {
      return wall.isOpen;
    });
    assert.strictEqual(connectedCellCount(maze), rows * cols);
    assert.strictEqual(openWalls.length, rows * cols - 1);
  });

  test("A* solves " + rows + "x" + cols + " from entrance to exit", function () {
    const maze = generate(rows, cols);
    const p = new ctx.Path();
    p.init(maze);
    p.getPath();

    assert.ok(p.pathFound(), "exit should be reached");
    assert.strictEqual(p.stepNode, p.exitNode, "marker should finish at the exit");

    //the route is stored from exit to entrance
    const route = p.path;
    assert.deepStrictEqual(
      { row: route[0].row, col: route[0].col },
      { row: p.exitNode.row, col: p.exitNode.col },
    );
    const last = route[route.length - 1];
    assert.deepStrictEqual(
      { row: last.row, col: last.col },
      { row: p.entranceNode.row, col: p.entranceNode.col },
    );
    assert.strictEqual(p.getPathLength(), route.length - 1);

    //every step moves to a neighbouring cell through an open wall
    for (let i = 0; i < route.length - 1; i++) {
      const from = p.getNode(route[i + 1].row, route[i + 1].col);
      const to = p.getNode(route[i].row, route[i].col);
      assert.ok(from.canGoTo(to), "step " + i + " crosses a wall");
    }
  });
});

test("entrance is on the left edge and exit on the right edge", function () {
  const maze = generate(4, 8);
  const p = new ctx.Path();
  for (let i = 0; i < 20; i++) {
    p.init(maze);
    assert.strictEqual(p.entranceNode.col, 0);
    assert.strictEqual(p.exitNode.col, 7);
    assert.ok(p.entranceNode.row >= 0 && p.entranceNode.row < 4);
    assert.ok(p.exitNode.row >= 0 && p.exitNode.row < 4);
  }
});

test("resize rebuilds the grid with the new dimensions", function () {
  const maze = new ctx.Maze(8, 8);
  maze.resize(4, 12);
  maze.prepare();
  assert.strictEqual(maze.rows, 4);
  assert.strictEqual(maze.cols, 12);
  assert.strictEqual(maze.cells.length, 48);
  //no wall is open until the maze is generated
  assert.ok(maze.walls.every(function (wall) {
    return !wall.isOpen;
  }));
  assert.strictEqual(maze.getProgress(), 0);
});

test("generation progress reaches 100%", function () {
  const maze = generate(8, 8);
  assert.strictEqual(maze.getProgress(), 1);
});

test("moveStep only passes through open walls", function () {
  const maze = generate(8, 8);
  const p = new ctx.Path();
  p.init(maze);
  const start = p.stepNode;
  let moved = 0;
  [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) {
    const target = p.getNode(start.row + d[0], start.col + d[1]);
    const open = target != null && start.canGoTo(target);
    p.setEntranceAndExit(start.row, start.col, p.exitNode.row, p.exitNode.col);
    assert.strictEqual(p.moveStep(d[0], d[1]), open);
    if (open) {
      moved++;
    }
  });
  assert.ok(moved >= 1, "a perfect maze has at least one open neighbour");
});

test("generation works when the random start cell is the last one", function () {
  vm.runInContext("var realRandom = Math.random; Math.random = function () { return 0.9999999; };", ctx);
  try {
    const maze = generate(4, 8);
    assert.strictEqual(connectedCellCount(maze), 32);
  } finally {
    vm.runInContext("Math.random = realRandom;", ctx);
  }
});
