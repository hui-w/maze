const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("startup registers optional games before starting Maze", () => {
  const registrations = [];
  const parent = {};
  class MazeGame {}
  class ExtraGame {}
  let onLoad;
  let started;
  const context = vm.createContext({
    MazeGame,
    ExtraGame,
    document: { body: parent },
    window: { location: { hash: "" }, addEventListener() {} },
    GameHost: class {
      constructor(element) {
        assert.equal(element, parent);
        this.games = new Map();
      }
      registerGame(command, game) {
        this.games.set(command, game);
        registrations.push([command, game]);
      }
      start(game) {
        started = game;
      }
    },
    addEventListener(type, handler) {
      assert.equal(type, "load");
      onLoad = handler;
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8"), context);
  vm.runInContext('registerGame("extra", ExtraGame)', context);
  onLoad();
  assert.deepEqual(registrations, [["maze", MazeGame], ["extra", ExtraGame]]);
  assert.equal(started, MazeGame);
});

test("source page registers Snake before startup", () => {
  const src = path.join(__dirname, "..", "src");
  const html = fs.readFileSync(path.join(src, "index.html"), "utf8");
  const scripts = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), (match) => match[1]);
  const configIndex = scripts.indexOf("maze/maze-config.js");
  const mazeIndex = scripts.indexOf("maze/maze-game.js");
  const appIndex = scripts.indexOf("app.js");
  const modelIndex = scripts.indexOf("snake-plugin/snake.js");
  const gameIndex = scripts.indexOf("snake-plugin/snake-game.js");
  assert.ok(configIndex >= 0 && configIndex < mazeIndex && mazeIndex < appIndex);
  assert.ok(appIndex < modelIndex && modelIndex < gameIndex);

  const registrations = [];
  let onLoad;
  const context = vm.createContext({
    MazeGame: class MazeGame {},
    document: { body: {} },
    window: { location: { hash: "#snake" }, addEventListener() {} },
    GameHost: class {
      constructor() {
        this.games = new Map();
      }
      registerGame(command, game) {
        this.games.set(command, game);
        registrations.push([command, game.name]);
      }
      start(game) { this.started = game.name; }
    },
    addEventListener(type, handler) {
      onLoad = handler;
    },
  });
  for (const index of [appIndex, modelIndex, gameIndex]) {
    const file = path.resolve(src, scripts[index]);
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  }
  onLoad();
  assert.deepEqual(registrations, [["maze", "MazeGame"], ["snake", "SnakeGame"]]);
});

test("fragments select games, follow navigation, and report unknown games", () => {
  let host;
  let onLoad;
  let onHashChange;
  class MazeGame {}
  class SnakeGame {}
  const window = {
    location: { hash: "#snake" },
    addEventListener(type, handler) {
      assert.equal(type, "hashchange");
      onHashChange = handler;
    },
  };
  const context = vm.createContext({
    MazeGame,
    SnakeGame,
    window,
    document: { body: {} },
    GameHost: class {
      constructor() {
        host = this;
        this.games = new Map();
        this.starts = [];
        this.errors = [];
        this.closed = 0;
      }
      registerGame(command, game) { this.games.set(command, game); }
      start(game) { this.starts.push(game); }
      showUnknownCommand(command) { this.errors.push(command); }
      closePalette() { this.closed++; }
    },
    addEventListener(type, handler) {
      onLoad = handler;
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8"), context);
  vm.runInContext('registerGame("snake", SnakeGame)', context);
  onLoad();
  assert.deepEqual(host.starts, [SnakeGame]);
  window.location.hash = "";
  onHashChange();
  assert.deepEqual(host.starts, [SnakeGame, MazeGame]);
  host.onSelectGame("snake", SnakeGame);
  assert.equal(window.location.hash, "#snake");
  onHashChange();
  assert.deepEqual(host.starts, [SnakeGame, MazeGame, SnakeGame]);
  window.location.hash = "#missing";
  onHashChange();
  assert.deepEqual(host.errors, ["missing"]);
  assert.deepEqual(host.starts, [SnakeGame, MazeGame, SnakeGame]);
  window.location.hash = "#snake";
  onHashChange();
  assert.equal(host.closed, 1);
  assert.deepEqual(host.starts, [SnakeGame, MazeGame, SnakeGame]);
  window.location.hash = "#maze";
  onHashChange();
  assert.deepEqual(host.starts, [SnakeGame, MazeGame, SnakeGame, MazeGame]);
});

test("unknown initial fragments start Maze and show an error", () => {
  let host;
  let onLoad;
  class MazeGame {}
  const context = vm.createContext({
    MazeGame,
    window: { location: { hash: "#snake" }, addEventListener() {} },
    document: { body: {} },
    GameHost: class {
      constructor() { host = this; this.games = new Map(); }
      registerGame(command, game) { this.games.set(command, game); }
      start(game) { this.started = game; }
      showUnknownCommand(command) { this.error = command; }
    },
    addEventListener(type, handler) { onLoad = handler; },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8"), context);
  onLoad();
  assert.equal(host.started, MazeGame);
  assert.equal(host.error, "snake");
});
