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
    }
    createChild() {
      const child = new Element();
      child.parentNode = this;
      this.children.push(child);
      return child;
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
    Config: { Game: { padding: 12, backgroundColor: "white" } },
    setInterval(callback) {
      intervals.set(1, callback);
      return 1;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
  }, "game-host.js");
  const GameHost = vm.runInContext("GameHost", context);
  const parent = new Element();
  const events = [];
  class ExampleGame {
    constructor(host) {
      this.host = host;
    }
    init() {
      this.host.resizeCanvas();
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
    destroy() {
      events.push(["destroy", this]);
    }
  }
  const host = new GameHost(parent);
  const first = host.start(ExampleGame);
  const oldCanvas = host.canvas;
  assert.equal(host.canvas.width, 1600);
  assert.equal(host.canvas.height, 800);
  assert.equal(host.canvas.style.width, "800px");
  document.listeners.keydown({ type: "keydown" });
  oldCanvas.listeners.pointerdown({ type: "pointerdown" });
  assert.deepEqual(events.slice(-2), [["input", "keydown"], ["input", "pointerdown"]]);

  const second = host.start(ExampleGame);
  assert.notEqual(first, second);
  assert.notEqual(oldCanvas, host.canvas);
  assert.equal(oldCanvas.listeners.pointerdown, undefined);
  assert.ok(events.some((event) => event[0] == "destroy" && event[1] == first));
  assert.equal(host.root.children.length, 1);
  document.documentElement.clientWidth = 424;
  intervals.get(1)();
  assert.equal(host.canvas.style.width, "400px");
  host.destroy();
  assert.ok(events.some((event) => event[0] == "destroy" && event[1] == second));
  assert.equal(intervals.size, 0);
  assert.equal(document.listeners.keydown, undefined);
  assert.equal(document.listeners.keyup, undefined);
  assert.equal(parent.children.length, 0);
});

test("cancelling animated maze generation prevents further steps", () => {
  const timers = new Map();
  let nextTimer = 0;
  const context = load({
    Config: { Maze: { stepDelay: 1 } },
    rand: () => 0,
    setTimeout(callback) {
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  }, "maze.js");
  vm.runInContext("Array.prototype.removeAt = function (i) { this.splice(i, 1); }", context);
  const Maze = vm.runInContext("Maze", context);
  const maze = new Maze(3, 3);
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
    Config: { Path: { stepDelay: 1 } },
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
  }, "maze-path.js");
  const MazePath = vm.runInContext("MazePath", context);
  const search = new MazePath();
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
