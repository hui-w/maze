const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("game pauses, resumes, resets edge mode, and cleans up its timer", () => {
  const timers = new Map();
  const settings = new Map();
  const messages = [];
  let nextTimer = 0;
  let registered;
  let captured = false;
  let redraws = 0;
  class Element {
    constructor() {
      this.children = [];
      this.value = "";
      this.className = "";
      this.classList = {
        contains: (name) => this.hasClassName(name),
        add: (name) => this.addClassName(name),
        toggle: (name, enabled) => enabled ? this.addClassName(name) : this.removeClassName(name),
      };
    }
    createChild(tag, attributes, text) {
      const child = new Element();
      child.tag = tag;
      child.value = attributes && attributes.value || "";
      child.className = attributes && attributes.class || "";
      child.textContent = text || "";
      this.children.push(child);
      return child;
    }
    hasClassName(name) {
      return this.className.split(" ").includes(name);
    }
    addClassName(name) {
      if (!this.hasClassName(name)) this.className += " " + name;
    }
    removeClassName(name) {
      this.className = this.className.split(" ").filter((part) => part != name).join(" ");
    }
    setAttribute(name, value) {
      this[name] = value;
    }
  }
  const context = vm.createContext({
    createChild(parent, tag, attributes, text) {
      return parent.createChild(tag, attributes, text);
    },
    loadGameSetting(game, key, allowed, fallback) {
      const value = settings.get(game + "." + key);
      return Object.prototype.hasOwnProperty.call(allowed, value) ? value : fallback;
    },
    saveGameSetting(game, key, value) {
      settings.set(game + "." + key, value);
    },
    drawGameMessage(ctx, text, width, height) {
      messages.push({ text, width, height });
    },
    registerGame(name, GameClass) {
      assert.equal(name, "snake");
      registered = GameClass;
    },
    setTimeout(callback, delay) {
      timers.set(++nextTimer, { callback, delay });
      return nextTimer;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  for (const file of ["snake.js", "snake-game.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context);
  }
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "..", "toolbar.js"), "utf8"),
    context,
  );
  const Toolbar = vm.runInContext("Toolbar", context);
  const host = {
    toolbar: new Element(),
    controls: new Toolbar(),
    canvas: {
      setPointerCapture() { captured = true; },
      hasPointerCapture() { return captured; },
      releasePointerCapture() { captured = false; },
    },
    resizeCanvas() {},
    redraw() { redraws++; },
    selectGame(command) { this.selectedGame = command; },
  };
  const game = new registered(host);
  game.init();
  assert.equal(game.size, 32);
  assert.equal(game.sizeButtons.M.tag, "button");
  assert.equal(game.sizeButtons.M["aria-pressed"], "true");
  assert.equal(game.sizeButtons.S["aria-pressed"], "false");
  assert.ok(game.sizeButtons.M.hasClassName("selected"));
  assert.equal(game.sizeButtons.XXS, undefined);
  assert.equal(game.resetButton.disabled, true);
  let foodDraws = 0;
  const borders = [];
  const canvas = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillRect() {}, arc() { foodDraws++; }, fill() {},
    strokeRect(x, y, width, height) {
      borders.push({ x, y, width, height, color: this.strokeStyle, lineWidth: this.lineWidth });
    },
  };
  game.draw(canvas, 10);
  assert.deepEqual(messages, [{ text: "Ready", width: 320, height: 320 }]);
  assert.equal(foodDraws, 0);
  assert.deepEqual(borders[0], {
    x: 0.5, y: 0.5, width: 319, height: 319, color: "#0B4F33", lineWidth: 1,
  });
  let prevented = 0;
  const space = (repeat = false) => game.handleInput({
    type: "keydown",
    key: " ",
    repeat,
    preventDefault() { prevented++; },
  });
  const beforeStart = redraws;
  space();
  assert.equal(game.state, "playing");
  assert.equal(game.resetButton.disabled, true);
  game.resetButton.onclick();
  assert.equal(game.state, "playing");
  assert.equal(timers.size, 1);
  assert.equal(redraws, beforeStart + 1);
  game.draw(canvas, 10);
  assert.equal(messages.length, 1);
  assert.equal(foodDraws, 1);
  space(true);
  assert.equal(game.state, "playing");
  assert.equal(timers.size, 1);
  space();
  assert.equal(game.state, "paused");
  assert.equal(game.resetButton.disabled, false);
  assert.equal(timers.size, 0);
  game.draw(canvas, 10);
  assert.equal(foodDraws, 2);
  space();
  assert.equal(game.state, "playing");
  assert.equal(game.resetButton.disabled, true);
  assert.equal(timers.size, 1);
  assert.equal(prevented, 4);
  game.snake.step = () => "lost";
  const lostTimer = timers.get(game.timer);
  timers.delete(game.timer);
  lostTimer.callback();
  assert.equal(game.resetButton.disabled, false);
  space();
  assert.equal(game.state, "lost");
  assert.equal(timers.size, 0);
  game.draw(canvas, 10);
  assert.deepEqual(messages.at(-1), { text: "Game Over", width: 320, height: 320 });
  assert.equal(foodDraws, 3);
  game.resetButton.onclick();
  assert.equal(game.state, "ready");
  assert.equal(game.resetButton.disabled, true);
  game.draw(canvas, 10);
  assert.deepEqual(messages.at(-1), { text: "Ready", width: 320, height: 320 });
  assert.equal(foodDraws, 3);
  game.start();
  game.snake.step = () => "won";
  const wonTimer = timers.get(game.timer);
  timers.delete(game.timer);
  wonTimer.callback();
  assert.equal(game.state, "won");
  assert.equal(game.resetButton.disabled, false);
  game.resetButton.onclick();
  assert.equal(game.state, "ready");
  assert.ok(game.speedButtons.NORMAL.hasClassName("selected"));
  game.sizeButtons.S.onclick();
  assert.equal(game.size, 24);
  assert.equal(game.snake.rows, 24);
  assert.equal(settings.get("snake.size"), "S");
  assert.ok(game.sizeButtons.S.hasClassName("selected"));
  game.edgeButtons["Wrap around"].onclick();
  assert.equal(game.snake.wrap, true);
  assert.equal(settings.get("snake.edges"), "Wrap around");
  const borderCount = borders.length;
  game.draw(canvas, 10);
  assert.equal(borders.length, borderCount);
  game.start();
  assert.equal(game.state, "playing");
  assert.ok(game.edgeButtons.Walls.hasClassName("disabled"));
  assert.ok(game.sizeButtons.XS.hasClassName("disabled"));
  assert.equal(game.sizeButtons.XS.disabled, true);
  game.edgeButtons.Walls.onclick();
  game.sizeButtons.XS.onclick();
  assert.equal(game.snake.wrap, true);
  assert.equal(game.size, 24);
  assert.equal(timers.size, 1);
  assert.equal(timers.get(game.timer).delay, 160);
  const snake = game.snake;
  const originalTimer = game.timer;
  game.speedButtons.FAST.onclick();
  assert.equal(game.snake, snake);
  assert.equal(game.state, "playing");
  assert.notEqual(game.timer, originalTimer);
  assert.equal(timers.has(originalTimer), false);
  assert.equal(timers.size, 1);
  assert.equal(timers.get(game.timer).delay, 80);
  assert.equal(settings.get("snake.speed"), "FAST");
  assert.ok(game.speedButtons.FAST.hasClassName("selected"));
  const footer = host.toolbar.children.at(-1);
  assert.equal(footer.className, "toolbar-footer");
  assert.equal(footer.children[0].textContent, "Copyright \u00A9 QLike.com");
  assert.equal(footer.children[1].textContent, "Back to Home");
  footer.children[1].onclick();
  assert.equal(host.selectedGame, "maze");
  game.handleInput({ type: "pointerdown", pointerId: 1, clientX: 0, clientY: 0 });
  assert.equal(captured, true);
  game.suspendInput();
  assert.equal(game.state, "paused");
  game.sizeButtons.XS.onclick();
  assert.equal(game.size, 24);
  assert.equal(captured, false);
  assert.equal(timers.size, 0);
  game.speedButtons.SLOW.onclick();
  assert.equal(timers.size, 0);
  assert.equal(game.snake, snake);
  game.start();
  assert.equal(timers.size, 1);
  assert.equal(timers.get(game.timer).delay, 250);
  game.handleInput({ type: "pointerdown", pointerId: 2, clientX: 0, clientY: 0 });
  game.snake.score = 3;
  game.pause();
  game.resetButton.onclick();
  assert.equal(game.state, "ready");
  assert.equal(game.snake.score, 0);
  assert.equal(game.snake.wrap, true);
  assert.equal(game.size, 24);
  assert.equal(game.delay, 250);
  assert.equal(timers.size, 0);
  assert.equal(captured, false);
  game.destroy();
  assert.equal(timers.size, 0);
  const next = new registered(host);
  assert.equal(next.size, 24);
  assert.equal(next.delay, 250);
  assert.equal(next.snake.wrap, true);
  next.init();
  assert.ok(next.edgeButtons["Wrap around"].hasClassName("selected"));
  next.edgeButtons.Walls.onclick();
  assert.equal(settings.get("snake.edges"), "Walls");
  assert.equal(new registered(host).snake.wrap, false);
  assert.equal(settings.has("maze.size"), false);
  settings.set("snake.size", "XXS");
  settings.set("snake.edges", "invalid");
  assert.equal(new registered(host).size, 32);
  assert.equal(new registered(host).snake.wrap, false);
});
