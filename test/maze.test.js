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
  ["common.js", "config.js", "maze.js", "astar.js", "path.js"].forEach(function (file) {
    const code = fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
    vm.runInContext(code, context, { filename: file });
  });
  vm.runInContext("Config.Maze.stepDelay = 0; Config.Path.stepDelay = 0;", context);
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
    assert.strictEqual(p.manuallySolved, false, "A* should not count as a manual solve");

    //the A* route is stored from entrance to exit
    const route = p.aStarPath;
    assert.deepStrictEqual(
      { row: route[0].row, col: route[0].col },
      { row: p.entranceNode.row, col: p.entranceNode.col },
    );
    const last = route[route.length - 1];
    assert.deepStrictEqual(
      { row: last.row, col: last.col },
      { row: p.exitNode.row, col: p.exitNode.col },
    );
    assert.strictEqual(p.getPathLength(), route.length - 1);

    //every step moves to a neighbouring cell through an open wall
    for (let i = 0; i < route.length - 1; i++) {
      const from = p.getNode(route[i].row, route[i].col);
      const to = p.getNode(route[i + 1].row, route[i + 1].col);
      assert.ok(from.canGoTo(to), "step " + i + " crosses a wall");
    }

    p.setEntranceAndExit(
      p.entranceNode.row,
      p.entranceNode.col,
      p.exitNode.row,
      p.exitNode.col,
    );
    for (let i = 1; i < route.length; i++) {
      const target = route[i];
      assert.ok(
        p.moveStep(target.row - p.stepNode.row, target.col - p.stepNode.col),
        "manual step " + i + " should reach the next cell",
      );
    }
    assert.strictEqual(p.manuallySolved, true, "manual arrival should mark the maze solved");

    //manual exit line: every cell walked, entrance first and exit last,
    //in the order visited (the A* route itself)
    //compare row/col literals, not the vm-context objects themselves
    assert.strictEqual(p.manualPath.length, route.length);
    assert.deepStrictEqual(
      { row: p.manualPath[0].row, col: p.manualPath[0].col },
      { row: p.entranceNode.row, col: p.entranceNode.col },
    );
    assert.deepStrictEqual(
      {
        row: p.manualPath[p.manualPath.length - 1].row,
        col: p.manualPath[p.manualPath.length - 1].col,
      },
      { row: p.exitNode.row, col: p.exitNode.col },
    );
    for (let i = 0; i < route.length; i++) {
      assert.deepStrictEqual(
        { row: p.manualPath[i].row, col: p.manualPath[i].col },
        {
          row: route[i].row,
          col: route[i].col,
        },
      );
    }
  });
});

test("manual path includes every visited cell, including backtracks", function () {
  const maze = generate(8, 8);
  const p = new ctx.Path();
  p.init(maze);
  p.getPath();
  const route = p.aStarPath;
  //walked order: entrance first, exit last (the A* route itself)
  const walked = route.slice();
  p.setEntranceAndExit(
    p.entranceNode.row,
    p.entranceNode.col,
    p.exitNode.row,
    p.exitNode.col,
  );
  //one step forward, back to the entrance, forward again, then on to the exit
  const steps = [walked[1], walked[0], walked[1]].concat(walked.slice(2));
  steps.forEach(function (target) {
    assert.ok(
      p.moveStep(target.row - p.stepNode.row, target.col - p.stepNode.col),
      "manual step to " + target.row + "," + target.col + " should succeed",
    );
  });
  assert.strictEqual(p.manuallySolved, true, "manual arrival should mark the maze solved");
  const expected = [walked[0], walked[1], walked[0]].concat(walked.slice(1));
  //compare row/col literals, not the vm-context arrays/objects themselves
  assert.strictEqual(p.manualPath.length, expected.length);
  expected.forEach(function (cell, i) {
    assert.deepStrictEqual(
      { row: p.manualPath[i].row, col: p.manualPath[i].col },
      { row: cell.row, col: cell.col },
    );
  });
});

test("step count is derived from the manual path", function () {
  const p = new ctx.Path();
  p.init();
  //no entrance yet: step count is null, not 0; Game.updateCounters
  //shows N/A for null, like Path Length before an auto solve
  assert.strictEqual(p.getStepCount(), null, "empty trail is null, not 0");
  assert.strictEqual(p.entranceNode, null);

  const maze = generate(8, 8);
  p.init(maze);
  p.getPath();
  const route = p.aStarPath;
  const walked = route.slice();
  p.setEntranceAndExit(
    p.entranceNode.row,
    p.entranceNode.col,
    p.exitNode.row,
    p.exitNode.col,
  );
  assert.strictEqual(p.getStepCount(), 0);

  for (let i = 1; i <= 2; i++) {
    const target = walked[i];
    assert.ok(p.moveStep(target.row - p.stepNode.row, target.col - p.stepNode.col));
  }
  assert.strictEqual(p.getStepCount(), 2);

  for (let i = 3; i < walked.length; i++) {
    const target = walked[i];
    assert.ok(p.moveStep(target.row - p.stepNode.row, target.col - p.stepNode.col));
  }
  assert.strictEqual(p.manuallySolved, true);
  assert.strictEqual(p.getStepCount(), walked.length - 1);

  //Show Path afterwards keeps the manual step count: getPath no longer clears the trail
  p.getPath();
  assert.strictEqual(p.manuallySolved, false);
  assert.strictEqual(p.getStepCount(), walked.length - 1);
});

test("AStar works on a plain graph, without a maze", function () {
  //plain nodes, no row/col, no maze, no canvas
  const a = { id: "A" };
  const b = { id: "B" };
  const c = { id: "C" };
  const d = { id: "D" };
  const graph = { A: [b, d], B: [c], C: [], D: [c] };
  const astar = new ctx.AStar(
    a,
    c,
    function (node) {
      return graph[node.id];
    },
    {
      getKey: function (node) {
        return node.id;
      },
    },
  );
  const route = astar.findPath();
  //start first, goal last, both included; the cheaper route wins
  //(A-B-C costs 2, A-D-C costs 2 as well, so either is valid here;
  //assert the ends and the length, not the middle, for this graph)
  assert.strictEqual(route[0], a);
  assert.strictEqual(route[route.length - 1], c);
  assert.strictEqual(route.length, 3);
  //no mutation: the search kept its links and scores to itself
  assert.deepStrictEqual(Object.keys(a), ["id"]);
  assert.deepStrictEqual(Object.keys(b), ["id"]);
  //no route at all returns null, not an empty route
  const blocked = new ctx.AStar(
    c,
    a,
    function (node) {
      return graph[node.id];
    },
    {
      getKey: function (node) {
        return node.id;
      },
    },
  );
  assert.strictEqual(blocked.findPath(), null);
  //start is the goal: the route is just the start node
  const same = new ctx.AStar(
    a,
    a,
    function (node) {
      return graph[node.id];
    },
    {
      getKey: function (node) {
        return node.id;
      },
    },
  );
  const sameRoute = same.findPath();
  //compare by identity, not deepStrictEqual: the route array is built
  //inside the vm context, so its prototype differs from this realm's
  assert.strictEqual(sameRoute.length, 1);
  assert.strictEqual(sameRoute[0], a);
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
