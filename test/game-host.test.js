const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load(context, ...files) {
  vm.createContext(context);
  for (const file of files) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"),
      context,
      { filename: file },
    );
  }
  return context;
}

test("host replaces games, dispatches input, and cleans up", () => {
  class Element {
    constructor() {
      this.children = [];
      this.style = {};
      this.listeners = {};
      this.classList = { add() {}, toggle() {}, contains() { return false; } };
    }
    createChild(tag, attributes, text) {
      const child = new Element();
      child.tag = tag;
      child.attributes = attributes || {};
      child.textContent = text || "";
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    get firstChild() {
      return this.children[0];
    }
    removeChild(child) {
      this.children.splice(this.children.indexOf(child), 1);
      child.parentNode = null;
    }
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
    removeEventListener(type) {
      delete this.listeners[type];
    }
    focus() {
      document.activeElement = this;
    }
    getContext() {
      return {
        setTransform() {},
        save() {},
        fillRect() {},
        restore() {},
      };
    }
  }
  const document = new Element();
  document.documentElement = { clientWidth: 824, clientHeight: 624 };
  document.removeEventListener = function (type) {
    delete this.listeners[type];
  };
  const intervals = new Map();
  const context = load({
    document,
    window: { devicePixelRatio: 2 },
    createChild(parent, tag, attributes, text) { return parent.createChild(tag, attributes, text); },
    setInterval(callback) {
      intervals.set(1, callback);
      return 1;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
  }, "toolbar.js", "game-host.js");
  const GameHost = vm.runInContext("GameHost", context);
  const parent = new Element();
  document.body = parent;
  const events = [];
  class ExampleGame {
    constructor(host) {
      this.host = host;
    }
    init() {
      this.host.resizeCanvas();
      this.host.controls.footer(this.host.toolbar, "About", () => {});
    }
    getGridSize() {
      return { rows: 10, cols: 20 };
    }
    draw(ctx, cellSize) {
      events.push(["draw", cellSize]);
    }
    handleInput(event) {
      events.push(["input", event.type]);
    }
    suspendInput() {
      events.push(["suspend", this]);
    }
    destroy() {
      events.push(["destroy", this]);
    }
  }
  const host = new GameHost(parent);
  host.registerGame("maze", ExampleGame);
  assert.throws(() => host.registerGame("maze", ExampleGame), /already registered/);
  assert.throws(() => host.registerGame("not a command", ExampleGame), /Invalid/);
  const first = host.start(ExampleGame);
  const oldCanvas = host.canvas;
  assert.equal(host.canvas.width, 1600);
  assert.equal(host.canvas.height, 800);
  assert.equal(host.canvas.style.width, "800px");
  assert.equal(host.canvas.attributes.tabindex, 0);
  assert.equal(host.canvas.attributes["aria-label"], "Game board");
  document.listeners.keydown({ type: "keydown" });
  oldCanvas.listeners.pointerdown({ type: "pointerdown" });
  assert.deepEqual(events.slice(-2), [["input", "keydown"], ["input", "pointerdown"]]);

  const button = { closest: (selector) => selector == "button" ? button : null };
  const input = {
    closest: (selector) => selector == "input, select, textarea, a[href], [contenteditable]" ? input : null,
  };
  const inputCount = events.filter((event) => event[0] == "input").length;
  document.listeners.keydown({ type: "keydown", key: " ", target: button });
  assert.equal(events.filter((event) => event[0] == "input").length, inputCount);
  document.listeners.keydown({ type: "keydown", key: "ArrowUp", target: input });
  assert.equal(events.filter((event) => event[0] == "input").length, inputCount);
  document.listeners.keydown({ type: "keydown", key: "ArrowUp", target: button });
  assert.equal(events.filter((event) => event[0] == "input").length, inputCount + 1);
  document.listeners.keyup({ type: "keyup", key: "ArrowUp", target: button });
  assert.equal(events.filter((event) => event[0] == "input").length, inputCount + 2);

  const previousFocus = new Element();
  previousFocus.isConnected = true;
  previousFocus.focus();
  const modalControl = new Element();
  let modalClosed = false;
  host.openModal([modalControl], () => { modalClosed = true; });
  assert.equal(document.activeElement, modalControl);
  const beforeModalInput = events.filter((event) => event[0] == "input").length;
  document.listeners.keydown({ type: "keydown", key: "ArrowUp" });
  oldCanvas.listeners.pointerdown({ type: "pointerdown" });
  assert.equal(events.filter((event) => event[0] == "input").length, beforeModalInput);
  document.listeners.keydown({ type: "keydown", key: "Escape", preventDefault() {} });
  assert.equal(modalClosed, true);
  assert.equal(document.activeElement, previousFocus);

  const paletteButton = host.toolbar.children[1].children[0].children[0];
  assert.equal(paletteButton.tag, "button");
  assert.equal(paletteButton.textContent, "QLike.com");
  assert.equal(paletteButton.attributes["aria-label"], "QLike.com, open command palette");
  assert.equal(host.logo.listeners.dblclick, undefined);
  paletteButton.onclick();
  assert.ok(events.some((event) => event[0] == "suspend" && event[1] == first));
  host.showUnknownCommand("missing");
  assert.equal(host.palette.controls[0].value, "missing");
  assert.equal(host.palette.message.textContent, "Unknown command: missing");
  const inputsBefore = events.filter((event) => event[0] == "input").length;
  document.listeners.keydown({ type: "keydown", key: "ArrowUp" });
  oldCanvas.listeners.pointermove({ type: "pointermove" });
  assert.equal(events.filter((event) => event[0] == "input").length, inputsBefore);
  host.palette.controls[2].focus();
  document.listeners.keydown({
    type: "keydown",
    key: "Tab",
    preventDefault() {},
  });
  assert.equal(document.activeElement, host.palette.controls[0]);
  let dialog = host.palette.overlay.children[0];
  host.palette.controls[0].value = "<missing>";
  dialog.onsubmit({ preventDefault() {} });
  assert.equal(dialog.children[3].textContent, "Unknown command: <missing>");
  assert.equal(host.game, first);
  let prevented = false;
  document.listeners.keydown({
    type: "keydown",
    key: "Escape",
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(host.palette, null);
  assert.equal(host.game, first);

  paletteButton.onclick();
  dialog = host.palette.overlay.children[0];
  host.palette.controls[0].value = "  MAZE  ";
  dialog.onsubmit({ preventDefault() {} });
  const second = host.game;
  assert.notEqual(first, second);
  assert.notEqual(oldCanvas, host.canvas);
  assert.equal(oldCanvas.listeners.pointerdown, undefined);
  assert.ok(events.some((event) => event[0] == "destroy" && event[1] == first));
  assert.equal(host.root.children.length, 2);
  document.documentElement.clientWidth = 424;
  intervals.get(1)();
  assert.equal(host.canvas.style.width, "400px");
  class OtherGame extends ExampleGame {}
  host.registerGame("other", OtherGame);
  host.openPalette();
  host.palette.controls[0].value = "other";
  host.palette.overlay.children[0].onsubmit({ preventDefault() {} });
  assert.ok(host.game instanceof OtherGame);
  assert.ok(events.some((event) => event[0] == "destroy" && event[1] == second));
  const third = host.game;
  assert.throws(() => host.selectGame("missing"), /Unknown game command/);
  host.selectGame("maze");
  assert.ok(events.some((event) => event[0] == "destroy" && event[1] == third));
  assert.ok(host.game instanceof ExampleGame);
  const fourth = host.game;
  host.openPalette();
  host.destroy();
  assert.ok(events.some((event) => event[0] == "destroy" && event[1] == fourth));
  assert.equal(intervals.size, 0);
  assert.equal(document.listeners.keydown, undefined);
  assert.equal(document.listeners.keyup, undefined);
  assert.equal(parent.children.length, 0);
});

test("maze prevents arrow-key scrolling while playing", () => {
  const context = load({
    MazeConfig: { GridSize: { XS: 16 }, Game: { defaultSize: "XS" } },
    Maze: class {},
    MazePath: class {},
  }, "maze/maze-game.js");
  const MazeGame = vm.runInContext("MazeGame", context);
  const game = new MazeGame({});
  game.state = vm.runInContext("GameState.Playing", context);
  game.startMoving = () => {};
  let prevented = false;
  game.keyDown({ keyCode: 38, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
});

test("cancelling animated maze generation prevents further steps", () => {
  const timers = new Map();
  let nextTimer = 0;
  const context = load({
    MazeConfig: { Maze: { stepDelay: 1 } },
    rand: () => 0,
    setTimeout(callback) {
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  }, "maze/maze.js");
  const Maze = vm.runInContext("Maze", context);
  const maze = new Maze(3, 3, 1);
  let updates = 0;
  let completions = 0;
  maze.onUpdateUI = () => updates++;
  maze.onInitComplete = () => completions++;
  maze.init();
  assert.equal(timers.size, 1);
  const staleCallback = timers.values().next().value;
  const previousUpdates = updates;
  maze.cancel();
  assert.equal(timers.size, 0);
  staleCallback();
  assert.equal(updates, previousUpdates);
  assert.equal(completions, 0);
});

test("cancelling an animated path search prevents further steps", () => {
  const timers = new Map();
  let nextTimer = 0;
  let steps = 0;
  const context = load({
    MazeConfig: { Path: { stepDelay: 1 } },
    AStar: class {
      init() {}
      isFound() { return false; }
      step() { steps++; return {}; }
    },
    setTimeout(callback) {
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  }, "maze/maze-path.js");
  const MazePath = vm.runInContext("MazePath", context);
  const search = new MazePath(1);
  search.entranceNode = {};
  search.exitNode = {};
  search.getPath();
  assert.equal(steps, 1);
  assert.equal(timers.size, 1);
  const staleCallback = timers.values().next().value;
  search.cancel();
  assert.equal(timers.size, 0);
  staleCallback();
  assert.equal(steps, 1);
});

test("maze instances keep animation delays independent", () => {
  const timers = new Map();
  let nextTimer = 0;
  const context = load({
    MazeConfig: { Maze: { stepDelay: 1 }, Path: { stepDelay: 1 } },
    rand: () => 0,
    AStar: class {
      init() { this.found = false; }
      isFound() { return this.found; }
      step() { this.found = true; return {}; }
      getRoute() { return []; }
    },
    setTimeout(callback) {
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout(id) { timers.delete(id); },
  }, "maze/maze.js", "maze/maze-path.js");
  const { Maze, MazePath } = vm.runInContext("({ Maze, MazePath })", context);
  const animated = new Maze(3, 3, 1);
  const immediate = new Maze(3, 3);
  let completed = false;
  immediate.onInitComplete = () => { completed = true; };
  animated.init();
  immediate.init();
  assert.equal(completed, true);
  assert.equal(timers.size, 1);
  animated.cancel();

  const animatedPath = new MazePath(1);
  const immediatePath = new MazePath();
  for (const search of [animatedPath, immediatePath]) {
    search.entranceNode = {};
    search.exitNode = {};
  }
  let pathCompleted = false;
  immediatePath.onPathComplete = () => { pathCompleted = true; };
  animatedPath.getPath();
  immediatePath.getPath();
  assert.equal(pathCompleted, true);
  assert.equal(timers.size, 1);
  animatedPath.cancel();
});

test("game settings are separate and invalid saved sizes fall back", () => {
  const values = new Map([["maze.size", "S"], ["snake.size", "invalid"]]);
  const context = {
    Element: { prototype: {} },
    CanvasRenderingContext2D: { prototype: {} },
    localStorage: {
      getItem(key) { return values.get(key) || null; },
      setItem(key, value) { values.set(key, value); },
    },
    console,
  };
  context.window = context;
  load(context, "common.js");
  assert.equal(context.loadGameSetting("maze", "size", { S: 24 }, "XS"), "S");
  assert.equal(context.loadGameSetting("snake", "size", { S: 24 }, "XS"), "XS");
  context.saveGameSetting("snake", "size", "S");
  assert.equal(values.get("snake.size"), "S");
  assert.equal(values.get("maze.size"), "S");
});
