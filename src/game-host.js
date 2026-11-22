/**
 * @author Wang, Hui (huiwang@qlike.com)
 * @repo https://github.com/hui-w/maze
 * @licence MIT
 */
class GameHost {
  constructor(parent) {
    this.root = parent.createChild("div", { id: "game-root" });
    this.game = null;
    this.width = document.documentElement.clientWidth;
    this.height = document.documentElement.clientHeight;

    this.handleInput = (event) => {
      if (this.game) {
        this.game.handleInput(event);
      }
    };
    document.addEventListener("keydown", this.handleInput, false);
    document.addEventListener("keyup", this.handleInput, false);

    this.resizeTimer = setInterval(() => {
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      if (width != this.width || height != this.height) {
        this.width = width;
        this.height = height;
        if (this.game) {
          this.resizeCanvas();
        }
      }
    }, 200);
  }

  start(GameClass) {
    if (this.game) {
      this.game.destroy();
      this.game = null;
      this.removePointerListeners();
    }
    while (this.root.firstChild) {
      this.root.removeChild(this.root.firstChild);
    }

    const wrapper = this.root.createChild("div", {
      id: "game-wrapper",
      style: "padding: " + Config.Game.padding + "px",
    });
    this.canvas = wrapper.createChild("canvas", {
      id: "game-canvas",
      width: 0,
      height: 0,
    });
    this.context = this.canvas.getContext("2d");
    ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach(
      (type) => this.canvas.addEventListener(type, this.handleInput),
    );

    this.game = new GameClass(this);
    this.game.init();
    return this.game;
  }

  removePointerListeners() {
    ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach(
      (type) => this.canvas.removeEventListener(type, this.handleInput),
    );
  }

  resizeCanvas() {
    const { rows, cols } = this.game.getGridSize();
    const boardWidth = Math.floor(this.width - Config.Game.padding * 2);
    const boardHeight = Math.floor(this.height - Config.Game.padding * 2);
    this.cellSize = Math.min(boardWidth / cols, boardHeight / rows);

    const ratio = window.devicePixelRatio || 1;
    this.canvasWidth = Math.round(cols * this.cellSize);
    this.canvasHeight = Math.round(rows * this.cellSize);
    this.canvas.width = Math.round(this.canvasWidth * ratio);
    this.canvas.height = Math.round(this.canvasHeight * ratio);
    this.canvas.style.width = this.canvasWidth + "px";
    this.canvas.style.height = this.canvasHeight + "px";
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.redraw();
  }

  redraw() {
    this.context.save();
    this.context.fillStyle = Config.Game.backgroundColor;
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.context.restore();
    this.game.draw(this.context, this.cellSize);
  }

  destroy() {
    if (this.game) {
      this.game.destroy();
      this.game = null;
      this.removePointerListeners();
    }
    clearInterval(this.resizeTimer);
    document.removeEventListener("keydown", this.handleInput, false);
    document.removeEventListener("keyup", this.handleInput, false);
    this.root.parentNode.removeChild(this.root);
  }
}
