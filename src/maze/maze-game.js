/**
 * @author Wang, Hui (huiwang@qlike.com)
 * @repo https://github.com/hui-w/maze
 * @licence MIT
 */
const GameState = {
  Setup: "Choose a size and generate a maze",
  Generating: "Generating maze...",
  Playing: "Maze ready - find your way to the exit",
  Solving: "Finding the path...",
  Finished: "Maze solved",
};

class MazeGame {
  constructor(host) {
    this.host = host;
    const size = MazeConfig.GridSize[MazeConfig.Game.defaultSize];
    this.maze = new Maze(size, size);
    this.path = new MazePath();
    this.state = GameState.Setup;
    this.settingControls = [];
    this.animationDelayButtons = {};
    this.sizeButtons = {};
    this.statusElement = null;
    this.pathButton = null;
    this.generateButton = null;
    this.randomButton = null;
    this.autoPath = false;
    this.playPart = null;

    //from 0000 to 1111 (Keys: left-up-right-bottom)
    this.arrowKeyStatus = 0;
    this.keyboardTimer = null;

  }

  init() {
    const that = this;
    this.selectedSize = loadGameSetting(
      "maze",
      "size",
      MazeConfig.GridSize,
      MazeConfig.Game.defaultSize,
    );
    this.selectedAnimationDelay = loadGameSetting(
      "maze",
      "animationDelay",
      MazeConfig.AnimationDelay.MazeGeneration,
      MazeConfig.Game.defaultAnimationDelay,
    );
    const size = MazeConfig.GridSize[this.selectedSize];
    this.maze.resize(size, size);
    this.render();

    //maze and path events
    const updateUI = () => {
      that.redraw();
    };
    this.maze.onUpdateUI = () => {
      updateUI();
      that.updateProgress();
    };
    this.path.onUpdateUI = updateUI;

    //initialize the maze; when it's done, initialize the path
    this.maze.onInitComplete = () => {
      that.path.init(that.maze);
      that.updateCounters();
      that.playPart.style.display = "";
      that.setState(GameState.Playing);
    };
    this.prepareMaze();

    this.path.onPathComplete = () => {
      that.autoPath = true;
      that.updateCounters();
      that.setState(GameState.Finished);
    };
  }

  setState(state) {
    this.state = state;
    //drop any held arrow keys so they cannot resume movement in the next round
    this.stopMoving();
    this.updateToolbar();
  }

  updateToolbar() {
    const s = this.state;
    this.statusElement.innerHTML = s + "<span></span>";
    this.updateProgress();
    const setEnabled = (element, enabled) =>
      this.host.controls.setEnabled(element, enabled);
    for (let i = 0; i < this.settingControls.length; i++) {
      //only locked while an animation is running
      setEnabled(
        this.settingControls[i],
        s != GameState.Generating && s != GameState.Solving,
      );
    }
    setEnabled(
      this.generateButton,
      s == GameState.Setup || s == GameState.Playing || s == GameState.Finished,
    );
    setEnabled(
      this.randomButton,
      s == GameState.Playing || s == GameState.Finished,
    );
    setEnabled(this.pathButton, s == GameState.Playing);
  }

  /* show the generation percentage next to the status text */
  updateProgress() {
    const element = this.statusElement.lastChild;
    if (!element) {
      return;
    }
    element.innerHTML =
      this.state == GameState.Generating
        ? " " + Math.floor(this.maze.getProgress() * 100) + "%"
        : "";
  }

  /* pick a new entrance and exit; the player goes back to the entrance */
  randomizeEntranceAndExit() {
    this.autoPath = false;
    this.path.randomEntranceAndExit();
    this.updateCounters();
    this.setState(GameState.Playing);
  }

  updateCounters() {
    //no entrance yet (Setup / Generating): getStepCount is null, and
    //Steps is not applicable, like Path Length before an auto solve
    const stepCount = this.path.getStepCount();
    this.stepsElement.textContent = stepCount == null ? "N/A" : stepCount;
    this.pathLengthElement.innerHTML = this.autoPath
      ? this.path.getPathLength()
      : "N/A";
  }

  render() {
    this.bindPointer();
    this.host.resizeCanvas();
    this.renderToolbar(this.host.toolbar);
  }

  handleInput(e) {
    if (e.type == "keydown") {
      this.keyDown(e);
    } else if (e.type == "keyup") {
      this.keyUp(e);
    } else {
      this.handlePointerEvent(e);
    }
  }

  renderToolbar(tools) {
    const that = this;

    createChild(tools,
      "div",
      { class: "toolbar-subtitle" },
      "A JavaScript maze game using Prim's algorithm for maze generation and A* for path finding.",
    );
    this.statusElement = this.host.controls.element(
      this.host.controls.element(tools, "|", false, null),
      "",
      true,
      null,
    );

    //separator
    this.host.controls.element(tools, "-", false, null);

    //animation delays (applies to both maze generation and path finding)
    this.animationDelayButtons = this.host.controls.options(
      tools,
      "Animation: ",
      MazeConfig.AnimationDelay.MazeGeneration,
      this.selectedAnimationDelay,
      (animationDelay) => {
        that.setAnimationDelay(animationDelay);
        saveGameSetting("maze", "animationDelay", animationDelay);
      },
    );
    this.settingControls.push(...Object.values(this.animationDelayButtons));

    //maze size
    this.sizeButtons = this.host.controls.options(
      tools,
      "Maze Size: ",
      MazeConfig.GridSize,
      this.selectedSize,
      (size) => {
        that.resizeMaze(size);
        saveGameSetting("maze", "size", size);
      },
    );
    this.settingControls.push(...Object.values(this.sizeButtons));
    this.setAnimationDelay(this.selectedAnimationDelay);

    //generate
    let line = this.host.controls.element(tools, "|", false, null);
    this.generateButton = this.host.controls.element(
      line,
      "Generate Maze",
      false,
      (e, obj) => {
        that.resetMaze();
      },
    );
    this.host.controls.element(line, " | ", false, null);
    this.randomButton = this.host.controls.element(
      line,
      "New Entrance & Exit",
      false,
      (e, obj) => {
        that.randomizeEntranceAndExit();
      },
    );

    //move, show path and counter stay hidden until the first maze is generated
    const part = createChild(tools, "div", {
      style: "display:none",
    });
    this.playPart = part;

    //separator
    this.host.controls.element(part, "-", false, null);

    //find the route: by hand or by computer
    this.host.controls.element(
      this.host.controls.element(part, "|", false, null),
      "Solve the maze",
      true,
      null,
    );

    //by hand
    this.host.controls.element(
      this.host.controls.element(part, "|", false, null),
      "&nbsp;&nbsp;Manual - use arrow keys or swipe",
      false,
      null,
    );
    line = this.host.controls.element(part, "|", false, null);
    this.host.controls.element(line, "&nbsp;&nbsp;&nbsp;&nbsp;Steps: ", false, null);
    this.stepsElement = createChild(line,
      "span",
      {
        id: "counter-steps",
        class: "highlighted",
      },
      "0",
    );

    //by computer
    line = this.host.controls.element(part, "|", false, null);
    this.host.controls.element(line, "&nbsp;&nbsp;Automatic - ", false, null);
    this.pathButton = this.host.controls.element(
      line,
      "Show Path",
      false,
      (e, obj) => {
        that.getPath();
      },
    );
    line = this.host.controls.element(part, "|", false, null);
    this.host.controls.element(
      line,
      "&nbsp;&nbsp;&nbsp;&nbsp;Path Length: ",
      false,
      null,
    );
    this.pathLengthElement = createChild(line,
      "span",
      {
        class: "highlighted",
      },
      "N/A",
    );

    this.host.controls.footer(tools, "About", () => {
      that.showAbout();
    });
  }

  /* modal dialog describing the game */
  showAbout() {
    if (this.closeAbout || this.host.modal) {
      return;
    }
    const overlay = createChild(document.body, "div", {
      id: "about-overlay",
      class: "about-overlay",
    });
    const dialog = createChild(overlay, "div", {
      class: "about-dialog",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "about-title",
    });
    createChild(dialog, "h2", { id: "about-title" }, "About this Maze Game");
    createChild(dialog,
      "p",
      null,
      "This game is a JavaScript implementation of maze generation and A* path finding, drawn on an HTML5 canvas.",
    );
    createChild(dialog, "h3", null, "Maze generation");
    createChild(dialog,
      "p",
      null,
      "The maze is a grid of cells separated by walls, all closed at the start. " +
        "The generator uses a randomized Prim's algorithm. It starts from a random cell and adds that cell's walls to a list. " +
        "It then repeatedly picks a random wall from the list. If the cells on both sides of the wall are already connected, " +
        "the wall is discarded to avoid a loop. Otherwise the wall is opened and the walls of the newly connected cell join the list. " +
        "The result is a perfect maze: it has no loops and no isolated areas, so there is exactly one route between any two cells.",
    );
    createChild(dialog, "h3", null, "Path finding (A*)");
    createChild(dialog,
      "p",
      null,
      "A* always expands the most promising node, scored as F = G + H. G is the cost of the route from the entrance to the node, " +
        "and H is the straight-line distance from the node to the exit. Discovered nodes wait in the open area, and expanded nodes move to the closed area. " +
        "When the exit is reached, the route is traced back to the entrance through the parent links. " +
        "Turn on the animation to watch the open and closed areas spread.",
    );
    createChild(dialog, "h3", null, "Source and feedback");
    createChild(dialog,
      "p",
      null,
      'GitHub: <a href="https://github.com/hui-w/maze" target="_blank">https://github.com/hui-w/maze</a><br>' +
        'Feedback: <a href="mailto:webmaster@qlike.com">webmaster@qlike.com</a>',
    );
    const close = () => this.host.closeModal();
    this.closeAbout = close;
    overlay.onclick = (e) => {
      if (e.target == overlay) {
        close();
      }
    };
    const button = createChild(dialog, "div", { class: "about-actions" });
    const closeButton = createChild(button,
      "button",
      { type: "button", class: "toolbar-linkbutton about-close" },
      "Close",
    );
    closeButton.onclick = close;
    this.host.openModal([...dialog.querySelectorAll("a[href]"), closeButton], () => {
      document.body.removeChild(overlay);
      this.closeAbout = null;
    });
  }

  /* A zero delay skips animation; other options use their configured delays */
  setAnimationDelay(animationDelay) {
    this.maze.stepDelay =
      MazeConfig.AnimationDelay.MazeGeneration[animationDelay];
    this.path.stepDelay = MazeConfig.AnimationDelay.PathFinding[animationDelay];
    this.host.controls.markSelected(this.animationDelayButtons, animationDelay);
  }

  resizeMaze(size) {
    const n = MazeConfig.GridSize[size];
    this.maze.resize(n, n);
    this.host.controls.markSelected(this.sizeButtons, size);
    this.host.resizeCanvas();
    this.prepareMaze();
  }

  /* show an empty maze (all walls closed) and wait for Generate Maze */
  prepareMaze() {
    this.autoPath = false;
    this.path.init();
    this.maze.prepare();
    this.updateCounters();
    this.setState(GameState.Setup);
    this.redraw();
  }

  /* keyboard events: key down */
  keyDown(e) {
    if (this.state != GameState.Playing) {
      return;
    }
    const keyCode = e.keyCode;
    switch (keyCode) {
      case 37:
        this.arrowKeyStatus |= 1;
        break;
      case 38:
        this.arrowKeyStatus |= 1 << 1;
        break;
      case 39:
        this.arrowKeyStatus |= 1 << 2;
        break;
      case 40:
        this.arrowKeyStatus |= 1 << 3;
        break;
      default:
        return;
    }
    e.preventDefault();
    this.startMoving();
  }

  /* move the player in the held directions, and repeat until all directions are released */
  startMoving() {
    const that = this;
    if (this.arrowKeyStatus == 0 || this.keyboardTimer != null) {
      return;
    }
    const keyboardTimerHandler = () => {
      let dRow = 0;
      let dCol = 0;
      if ((that.arrowKeyStatus & 1) > 0) {
        //left
        dCol--;
      }

      if ((that.arrowKeyStatus & (1 << 1)) > 0) {
        //up
        dRow--;
      }

      if ((that.arrowKeyStatus & (1 << 2)) > 0) {
        //right
        dCol++;
      }

      if ((that.arrowKeyStatus & (1 << 3)) > 0) {
        //bottom
        dRow++;
      }

      if (that.arrowKeyStatus > 0) {
        that.moveStep(dRow, dCol);

        if (that.arrowKeyStatus > 0) {
          that.keyboardTimer = setTimeout(
            keyboardTimerHandler,
            MazeConfig.Game.keyboardTimerDelay,
          );
        } else {
          that.keyboardTimer = null;
        }
      } else {
        that.keyboardTimer = null;
      }
    };
    keyboardTimerHandler();
  }

  /* touch and mouse: press anywhere on the maze and drag; the player moves in the drag direction while held */
  bindPointer() {
    const that = this;
    const canvas = this.host.canvas;
    let activePointer = null;
    let startX = 0;
    let startY = 0;

    const update = (e) => {
      if (that.state != GameState.Playing) {
        that.stopMoving();
        return;
      }
      let dx = e.clientX - startX;
      let dy = e.clientY - startY;

      //the press point trails behind the finger, so changing direction only needs a short drag
      const max = MazeConfig.Game.dragThreshold * 3;
      if (Math.abs(dx) > max) {
        startX += dx - (dx > 0 ? max : -max);
        dx = dx > 0 ? max : -max;
      }
      if (Math.abs(dy) > max) {
        startY += dy - (dy > 0 ? max : -max);
        dy = dy > 0 ? max : -max;
      }

      //stay still until the pointer has moved far enough from where it was pressed
      if (
        Math.abs(dx) < MazeConfig.Game.dragThreshold &&
        Math.abs(dy) < MazeConfig.Game.dragThreshold
      ) {
        that.arrowKeyStatus = 0;
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        that.arrowKeyStatus = dx < 0 ? 1 : 1 << 2;
      } else {
        that.arrowKeyStatus = dy < 0 ? 1 << 1 : 1 << 3;
      }
      that.startMoving();
    };

    const release = (e) => {
      if (activePointer == e.pointerId) {
        activePointer = null;
        that.stopMoving();
      }
    };

    this.resetPointer = () => {
      if (activePointer != null && canvas.hasPointerCapture(activePointer)) {
        canvas.releasePointerCapture(activePointer);
      }
      activePointer = null;
    };

    this.handlePointerEvent = (e) => {
      if (e.type == "pointerdown") {
        if (that.state != GameState.Playing || activePointer != null) {
          return;
        }
        activePointer = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      } else if (e.type == "pointermove") {
        if (activePointer == e.pointerId) {
          update(e);
        }
      } else {
        release(e);
      }
    };
  }

  stopMoving() {
    this.arrowKeyStatus = 0;
    if (this.keyboardTimer != null) {
      clearTimeout(this.keyboardTimer);
      this.keyboardTimer = null;
    }
  }

  /* keyboard events: key up */
  keyUp(e) {
    const keyCode = e.keyCode;
    switch (keyCode) {
      case 37:
        this.arrowKeyStatus &= ~1;
        break;
      case 38:
        this.arrowKeyStatus &= ~(1 << 1);
        break;
      case 39:
        this.arrowKeyStatus &= ~(1 << 2);
        break;
      case 40:
        this.arrowKeyStatus &= ~(1 << 3);
        break;
    }
    if (this.arrowKeyStatus == 0) {
      if (this.keyboardTimer != null) {
        clearTimeout(this.keyboardTimer);
        this.keyboardTimer = null;
      }
    }
  }

  getGridSize() {
    return { rows: this.maze.rows, cols: this.maze.cols };
  }

  redraw() {
    this.host.redraw();
  }

  draw(context, cellSize) {
    this.maze.redraw(context, cellSize);
    this.path.redraw(context, cellSize);
  }

  suspendInput() {
    this.resetPointer();
    this.stopMoving();
  }

  destroy() {
    this.suspendInput();
    this.maze.cancel();
    this.path.cancel();
    if (this.closeAbout) {
      this.closeAbout();
    }
  }

  resetMaze() {
    this.autoPath = false;
    this.setState(GameState.Generating);
    this.path.init(); //initialize without maze will clear current path content immediately
    this.maze.init(); //the path will be initialized when the maze initComplete
    this.updateCounters();
  }

  getPath() {
    if (this.state != GameState.Playing) {
      return;
    }
    this.setState(GameState.Solving);
    this.path.getPath();
  }

  moveStep(dRow, dCol) {
    if (this.state != GameState.Playing) {
      return;
    }
    this.path.moveStep(dRow, dCol);
    this.updateCounters();
    if (this.path.isAtExit()) {
      this.setState(GameState.Finished);
    }
  }
}
