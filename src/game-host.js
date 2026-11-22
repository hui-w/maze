/**
 * @author Wang, Hui (huiwang@qlike.com)
 * @repo https://github.com/hui-w/maze
 * @licence MIT
 */
const GameHostConfig = { padding: 12, backgroundColor: "#FFFDF7" };

class GameHost {
  constructor(parent) {
    this.root = createChild(parent, "div", { id: "game-root" });
    this.game = null;
    this.controls = new Toolbar(() => this.openPalette());
    this.games = new Map();
    this.palette = null;
    this.modal = null;
    this.onSelectGame = (command, GameClass) => this.start(GameClass);
    this.width = document.documentElement.clientWidth;
    this.height = document.documentElement.clientHeight;

    this.handleInput = (event) => {
      if (this.modal) {
        if (event.type == "keydown" && event.key == "Escape") {
          event.preventDefault();
          this.closeModal();
        } else if (event.type == "keydown" && event.key == "Tab") {
          const controls = this.modal.controls;
          const index = controls.indexOf(document.activeElement);
          if (index < 0 || (event.shiftKey && index == 0)) {
            event.preventDefault();
            controls[controls.length - 1].focus();
          } else if (!event.shiftKey && index == controls.length - 1) {
            event.preventDefault();
            controls[0].focus();
          }
        }
      } else if (this.game) {
        const target = event.target;
        const direction = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key);
        const textControl = target && (target.isContentEditable ||
          target.closest?.("input, select, textarea, a[href], [contenteditable]"));
        const button = target && target.closest?.("button");
        if (event.type != "keydown" || (!textControl && (!button || direction))) {
          this.game.handleInput(event);
        }
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

  registerGame(command, GameClass) {
    if (!/^[a-z][a-z0-9-]*$/.test(command) || typeof GameClass != "function") {
      throw new Error("Invalid game registration: " + command);
    }
    if (this.games.has(command)) {
      throw new Error("Game command already registered: " + command);
    }
    this.games.set(command, GameClass);
  }

  selectGame(command) {
    const GameClass = this.games.get(command);
    if (!GameClass) {
      throw new Error("Unknown game command: " + command);
    }
    this.onSelectGame(command, GameClass);
  }

  start(GameClass) {
    this.closeModal();
    if (this.game) {
      this.game.destroy();
      this.game = null;
      this.removePointerListeners();
    }
    while (this.root.firstChild) {
      this.root.removeChild(this.root.firstChild);
    }

    const wrapper = createChild(this.root, "div", {
      id: "game-wrapper",
      style: "padding: " + GameHostConfig.padding + "px",
    });
    this.canvas = createChild(wrapper, "canvas", {
      id: "game-canvas",
      width: 0,
      height: 0,
      tabindex: 0,
      role: "img",
      "aria-label": "Game board",
    });
    this.context = this.canvas.getContext("2d");
    ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach(
      (type) => this.canvas.addEventListener(type, this.handleInput),
    );

    this.toolbar = createChild(this.root, "div", {
      style: "padding:" + GameHostConfig.padding + "px;",
      class: "toolbar",
    });
    this.logo = createChild(this.toolbar, "img", {
      src: "static/logo.png",
      width: 100,
      style: "margin: 0 0 6px 0",
      alt: "QLike",
    });
    this.game = new GameClass(this);
    this.game.init();
    return this.game;
  }

  openPalette() {
    if (this.palette || !this.game) {
      return;
    }
    this.closeModal();
    const overlay = createChild(document.body, "div", {
      class: "command-overlay",
    });
    const dialog = createChild(overlay, "form", {
      class: "command-dialog",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "command-title",
    });
    createChild(dialog, "h2", { id: "command-title" }, "Command Palette");
    createChild(dialog, "label", { for: "command-input" }, "Command");
    const input = createChild(dialog, "input", {
      id: "command-input",
      type: "text",
      autocomplete: "off",
      spellcheck: "false",
    });
    const message = createChild(dialog, "p", {
      class: "command-message",
      "aria-live": "polite",
    });
    const actions = createChild(dialog, "div", { class: "command-actions" });
    const cancel = createChild(actions, "button", { type: "button" }, "Cancel");
    const run = createChild(actions, "button", { type: "submit" }, "Run");
    const controls = [input, cancel, run];
    this.palette = { overlay, controls, message };

    cancel.onclick = () => this.closePalette();
    overlay.onclick = (event) => {
      if (event.target == overlay) {
        this.closePalette();
      }
    };
    dialog.onsubmit = (event) => {
      event.preventDefault();
      const command = input.value.trim().toLowerCase();
      const GameClass = this.games.get(command);
      if (!GameClass) {
        message.textContent = "Unknown command: " + (command || "(empty)");
        return;
      }
      this.selectGame(command);
    };
    this.openModal(controls, () => {
      this.palette = null;
      overlay.parentNode.removeChild(overlay);
    });
  }

  showUnknownCommand(command) {
    this.openPalette();
    const input = this.palette.controls[0];
    input.value = command;
    this.palette.message.textContent = "Unknown command: " + command;
    input.focus();
  }

  closePalette() {
    if (this.palette) {
      this.closeModal();
    }
  }

  openModal(controls, onClose) {
    if (this.modal) {
      throw new Error("A modal is already open");
    }
    this.game.suspendInput();
    this.modal = { controls, onClose, previousFocus: document.activeElement };
    controls[0].focus();
  }

  closeModal() {
    if (!this.modal) {
      return;
    }
    const { onClose, previousFocus } = this.modal;
    this.modal = null;
    onClose();
    if (previousFocus && previousFocus.isConnected) {
      previousFocus.focus();
    }
  }

  removePointerListeners() {
    ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach(
      (type) => this.canvas.removeEventListener(type, this.handleInput),
    );
  }

  resizeCanvas() {
    const { rows, cols } = this.game.getGridSize();
    const boardWidth = Math.floor(this.width - GameHostConfig.padding * 2);
    const boardHeight = Math.floor(this.height - GameHostConfig.padding * 2);
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
    this.context.fillStyle = GameHostConfig.backgroundColor;
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.context.restore();
    this.game.draw(this.context, this.cellSize);
  }

  destroy() {
    this.closeModal();
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
