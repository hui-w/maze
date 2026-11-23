const SnakeSpeed = { SLOW: 250, NORMAL: 160, FAST: 80 };
const SnakeGridSize = { XS: 16, S: 24, M: 32, L: 48, XL: 64 };
const SnakeDragThreshold = 12;

class SnakeGame {
  constructor(host) {
    this.host = host;
    this.selectedSize = loadGameSetting("snake", "size", SnakeGridSize, "M");
    this.size = SnakeGridSize[this.selectedSize];
    this.edgeOptions = { ON: true, OFF: false };
    const savedEdges = loadGameSetting(
      "snake",
      "edges",
      { Walls: false, "Wrap around": true },
      "Walls",
    );
    this.edgeMode = savedEdges == "Wrap around" ? "ON" : "OFF";
    this.selfCollisionOptions = { ON: true, OFF: false };
    this.selfCollisionMode = loadGameSetting(
      "snake",
      "selfCollision",
      this.selfCollisionOptions,
      "ON",
    );
    this.selectedSpeed = loadGameSetting(
      "snake",
      "speed",
      SnakeSpeed,
      "NORMAL",
    );
    this.delay = SnakeSpeed[this.selectedSpeed];
    this.state = "ready";
    this.timer = null;
    this.elapsedPlayTime = 0;
    this.playStartedAt = null;
    this.activePointer = null;
    this.snake = new Snake(
      this.size,
      this.size,
      this.edgeOptions[this.edgeMode],
      undefined,
      this.selfCollisionOptions[this.selfCollisionMode],
    );
  }

  init() {
    const tools = this.host.toolbar;
    const controls = this.host.controls;
    createChild(
      tools,
      "div",
      { class: "toolbar-subtitle" },
      "Snake plugin<br>Use arrow keys or swipe to steer.<br>Press Space to start, pause, or resume.",
    );
    this.status = controls.element(
      controls.element(tools, "|", false, null),
      "",
      true,
      null,
    );
    controls.element(tools, "-", false, null);
    this.speedButtons = controls.options(
      tools,
      "Snake Speed: ",
      SnakeSpeed,
      this.selectedSpeed,
      (speed) => {
        this.selectedSpeed = speed;
        this.delay = SnakeSpeed[speed];
        saveGameSetting("snake", "speed", speed);
        controls.markSelected(this.speedButtons, speed);
        if (this.state == "playing") {
          this.stopTimer();
          this.schedule();
        }
      },
    );
    this.sizeButtons = controls.options(
      tools,
      "Board Size: ",
      SnakeGridSize,
      this.selectedSize,
      (size) => {
        this.selectedSize = size;
        this.size = SnakeGridSize[size];
        saveGameSetting("snake", "size", size);
        controls.markSelected(this.sizeButtons, size);
        this.reset(true);
      },
    );
    this.edgeButtons = controls.options(
      tools,
      "Edge Wrapping: ",
      this.edgeOptions,
      this.edgeMode,
      (mode) => {
        this.edgeMode = mode;
        saveGameSetting("snake", "edges", mode == "ON" ? "Wrap around" : "Walls");
        controls.markSelected(this.edgeButtons, mode);
        this.reset();
      },
    );
    this.selfCollisionButtons = controls.options(
      tools,
      "Self-Collision: ",
      this.selfCollisionOptions,
      this.selfCollisionMode,
      (mode) => {
        this.selfCollisionMode = mode;
        saveGameSetting("snake", "selfCollision", mode);
        controls.markSelected(this.selfCollisionButtons, mode);
        this.reset();
      },
    );

    const actions = controls.element(tools, "|", false, null);
    this.startButton = controls.element(actions, "Start", false, () =>
      this.start(),
    );
    controls.element(actions, " | ", false, null);
    this.pauseButton = controls.element(actions, "Pause", false, () =>
      this.togglePlay(),
    );
    controls.element(actions, " | ", false, null);
    this.resetButton = controls.element(actions, "Reset", false, () =>
      this.reset(),
    );
    controls.element(tools, "-", false, null);
    const scoreLine = controls.element(tools, "|", false, null);
    controls.element(scoreLine, "Food Collected: ", false, null).classList.add("snake-stat-label");
    this.score = createChild(scoreLine, "span", { class: "highlighted" });
    const timeLine = controls.element(tools, "|", false, null);
    controls.element(timeLine, "Elapsed Time: ", false, null).classList.add("snake-stat-label");
    this.time = createChild(timeLine, "span", { class: "highlighted" });
    const rateLine = controls.element(tools, "|", false, null);
    controls.element(rateLine, "Collection Rate: ", false, null).classList.add("snake-stat-label");
    this.rate = createChild(rateLine, "span", { class: "highlighted" });
    controls.footer(tools, "Back to Home", () => this.host.selectGame("maze"));
    this.updateToolbar();
    this.host.resizeCanvas();
  }

  getGridSize() {
    return { rows: this.size, cols: this.size };
  }

  updateToolbar() {
    const messages = {
      ready: "Ready to play",
      playing: "Playing",
      paused: "Paused",
      lost: "Game over",
      won: "You won!",
    };
    this.status.textContent = messages[this.state];
    const elapsed =
      this.elapsedPlayTime +
      (this.playStartedAt == null ? 0 : performance.now() - this.playStartedAt);
    const rate = elapsed > 0 ? (this.snake.score * 60000) / elapsed : 0;
    const seconds = Math.floor(elapsed / 1000);
    this.score.textContent = this.snake.score;
    this.rate.textContent = `${rate.toFixed(1)}/min`;
    this.time.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    const controls = this.host.controls;
    controls.setEnabled(this.startButton, this.state == "ready");
    controls.setEnabled(
      this.pauseButton,
      this.state == "playing" || this.state == "paused",
    );
    controls.setEnabled(
      this.resetButton,
      this.state == "paused" || this.state == "lost" || this.state == "won",
    );
    this.pauseButton.textContent = this.state == "paused" ? "Resume" : "Pause";
    const settingsEnabled = this.state != "playing" && this.state != "paused";
    const buttons = [
      ...Object.values(this.sizeButtons),
      ...Object.values(this.edgeButtons),
      ...Object.values(this.selfCollisionButtons),
    ];
    for (const button of buttons) {
      controls.setEnabled(button, settingsEnabled);
    }
  }

  reset(resize = false) {
    this.stopTimer();
    this.releasePointer();
    this.elapsedPlayTime = 0;
    this.playStartedAt = null;
    this.snake = new Snake(
      this.size,
      this.size,
      this.edgeOptions[this.edgeMode],
      undefined,
      this.selfCollisionOptions[this.selfCollisionMode],
    );
    this.state = "ready";
    this.updateToolbar();
    if (resize) {
      this.host.resizeCanvas();
    } else {
      this.host.redraw();
    }
  }

  start() {
    if (this.state != "ready" && this.state != "paused") {
      return;
    }
    this.state = "playing";
    this.playStartedAt = performance.now();
    this.updateToolbar();
    this.host.redraw();
    this.schedule();
  }

  schedule() {
    this.timer = setTimeout(() => {
      this.timer = null;
      const outcome = this.snake.step();
      if (outcome) {
        this.elapsedPlayTime += performance.now() - this.playStartedAt;
        this.playStartedAt = null;
        this.state = outcome;
      }
      this.updateToolbar();
      this.host.redraw();
      if (this.state == "playing") {
        this.schedule();
      }
    }, this.delay);
  }

  stopTimer() {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  pause() {
    if (this.state == "playing") {
      this.stopTimer();
      this.elapsedPlayTime += performance.now() - this.playStartedAt;
      this.playStartedAt = null;
      this.state = "paused";
      this.updateToolbar();
    }
    this.releasePointer();
  }

  togglePlay() {
    if (this.state == "playing") {
      this.pause();
    } else {
      this.start();
    }
  }

  handleInput(event) {
    if (event.type == "keydown") {
      if (event.key == " ") {
        event.preventDefault();
        if (!event.repeat) {
          this.togglePlay();
        }
        return;
      }
      const directions = {
        ArrowLeft: [0, -1],
        ArrowUp: [-1, 0],
        ArrowRight: [0, 1],
        ArrowDown: [1, 0],
      };
      const direction = directions[event.key];
      if (direction && this.state == "playing") {
        event.preventDefault();
        this.snake.turn(direction[0], direction[1]);
      }
      return;
    }
    if (
      event.type == "pointerdown" &&
      this.state == "playing" &&
      this.activePointer == null
    ) {
      this.activePointer = event.pointerId;
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.host.canvas.setPointerCapture(event.pointerId);
    } else if (
      event.type == "pointermove" &&
      this.state == "playing" &&
      event.pointerId == this.activePointer
    ) {
      const dx = event.clientX - this.pointerX;
      const dy = event.clientY - this.pointerY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= SnakeDragThreshold) {
        if (Math.abs(dx) > Math.abs(dy)) {
          this.snake.turn(0, Math.sign(dx));
        } else {
          this.snake.turn(Math.sign(dy), 0);
        }
        this.pointerX = event.clientX;
        this.pointerY = event.clientY;
      }
    } else if (
      (event.type == "pointerup" || event.type == "pointercancel") &&
      event.pointerId == this.activePointer
    ) {
      this.activePointer = null;
    }
  }

  draw(context, cellSize) {
    context.save();
    context.strokeStyle = "#e6d9b8";
    context.lineWidth = 0.5;
    context.beginPath();
    for (let i = 0; i <= this.size; i++) {
      context.moveTo(i * cellSize, 0);
      context.lineTo(i * cellSize, this.size * cellSize);
      context.moveTo(0, i * cellSize);
      context.lineTo(this.size * cellSize, i * cellSize);
    }
    context.stroke();
    const padding = Math.min(1, cellSize * 0.1);
    for (let index = this.snake.body.length - 1; index >= 0; index--) {
      const cell = this.snake.body[index];
      context.fillStyle = index == 0 ? "#0b4f33" : "#009c58";
      context.fillRect(
        cell.col * cellSize + padding,
        cell.row * cellSize + padding,
        cellSize - 2 * padding,
        cellSize - 2 * padding,
      );
    }
    if (this.state != "ready" && this.snake.food) {
      context.fillStyle = "#d94530";
      context.beginPath();
      context.arc(
        (this.snake.food.col + 0.5) * cellSize,
        (this.snake.food.row + 0.5) * cellSize,
        cellSize * 0.35,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    if (!this.snake.wrap) {
      const edge = Math.round(this.size * cellSize) - 1;
      context.strokeStyle = "#0B4F33";
      context.lineWidth = 1;
      context.strokeRect(0.5, 0.5, edge, edge);
    }
    if (this.state == "ready" || this.state == "lost") {
      const message = this.state == "ready" ? "Ready" : "Game Over";
      drawGameMessage(
        context,
        message,
        this.size * cellSize,
        this.size * cellSize,
      );
    }
    context.restore();
  }

  releasePointer() {
    if (
      this.activePointer != null &&
      this.host.canvas.hasPointerCapture(this.activePointer)
    ) {
      this.host.canvas.releasePointerCapture(this.activePointer);
    }
    this.activePointer = null;
  }

  suspendInput() {
    this.pause();
  }

  destroy() {
    this.suspendInput();
    this.stopTimer();
  }
}

registerGame("snake", SnakeGame);
