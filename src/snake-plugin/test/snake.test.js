const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "snake.js"), "utf8"),
  context,
);
const Snake = vm.runInContext("Snake", context);

test("the snake starts at the left with room to move right", () => {
  for (const size of [16, 24, 32, 48, 64]) {
    const snake = new Snake(size, size, false, () => 0);
    assert.equal(snake.body[0].col, 2);
    assert.equal(snake.body.at(-1).col, 0);
    assert.equal(snake.step(), null);
    assert.equal(snake.body[0].col, 3);
  }
});

test("edges either end the game or wrap to the opposite side", () => {
  const walls = new Snake(4, 4, false, () => 0);
  walls.step();
  assert.equal(walls.step(), "lost");

  const wrap = new Snake(4, 4, true, () => 0);
  wrap.step();
  assert.equal(wrap.step(), null);
  assert.equal(wrap.body[0].row, 2);
  assert.equal(wrap.body[0].col, 0);
});

test("food grows the snake and never appears on its body", () => {
  const snake = new Snake(4, 4, false, () => 0);
  snake.food = { row: 2, col: 3 };
  snake.step();
  assert.equal(snake.body.length, 4);
  assert.equal(snake.score, 1);
  assert.ok(snake.food);
  assert.ok(!snake.body.some((cell) => cell.row == snake.food.row && cell.col == snake.food.col));
});

test("turns cannot reverse or make two turns in one tick", () => {
  const snake = new Snake(6, 6, false, () => 0);
  snake.turn(0, -1);
  assert.equal(snake.nextDirection, null);
  snake.turn(-1, 0);
  snake.turn(0, -1);
  snake.step();
  assert.equal(snake.body[0].row, 2);
  assert.equal(snake.body[0].col, 2);
  snake.turn(0, -1);
  snake.step();
  assert.equal(snake.body[0].col, 1);
});

test("moving into the departing tail is allowed, but hitting the body loses", () => {
  const snake = new Snake(4, 4, false, () => 0);
  snake.body = [{ row: 1, col: 1 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }];
  snake.direction = { row: 1, col: 0 };
  snake.food = { row: 3, col: 3 };
  assert.equal(snake.step(), null);
  assert.equal(snake.body[0].row, 2);
  assert.equal(snake.body[0].col, 1);

  snake.body = [
    { row: 1, col: 1 }, { row: 1, col: 0 }, { row: 2, col: 0 },
    { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 1, col: 2 },
  ];
  assert.equal(snake.step(), "lost");
});

test("disabling self-collision allows crossing the body but not walls", () => {
  const snake = new Snake(4, 4, false, () => 0, false);
  snake.body = [
    { row: 1, col: 1 }, { row: 1, col: 0 }, { row: 2, col: 0 },
    { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 1, col: 2 },
  ];
  snake.direction = { row: 1, col: 0 };
  snake.food = { row: 3, col: 3 };
  assert.equal(snake.step(), null);
  assert.equal(snake.body[0].row, 2);
  assert.equal(snake.body[0].col, 1);
  assert.equal(snake.step(), null);
  assert.equal(snake.step(), "lost");
});

test("filling the board wins instead of attempting to place food", () => {
  const snake = new Snake(3, 3, false, () => 0);
  snake.body = [
    { row: 2, col: 1 }, { row: 2, col: 0 }, { row: 1, col: 0 },
    { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 0, col: 2 },
    { row: 0, col: 1 }, { row: 0, col: 0 },
  ];
  snake.direction = { row: 0, col: 1 };
  snake.food = { row: 2, col: 2 };
  assert.equal(snake.step(), "won");
  assert.equal(snake.food, null);
  assert.equal(snake.body.length, 9);
});
