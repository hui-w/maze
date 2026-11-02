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

function Game() {
  const size = Config.MazeSize[Config.Game.defaultSize];
  this.maze = new Maze(size, size);
  this.path = new Path();
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

  this.width = 0;
  this.height = 0;
  this.cellSize = 0;

  this.canvas = null;
  this.context = null;

  //from 0000 to 1111 (Keys: left-up-right-bottom)
  this.arrowKeyStatus = 0;
  this.keyboardTimer = null;

  //initialize
  this.init();
}

Game.prototype = {
  init: function () {
    const that = this;
    this.width = document.documentElement.clientWidth;
    this.height = document.documentElement.clientHeight;
    this.selectedSize = this.loadSetting(
      "size",
      Config.MazeSize,
      Config.Game.defaultSize,
    );
    this.selectedAnimationDelay = this.loadSetting(
      "animationDelay",
      Config.AnimationDelay.MazeGeneration,
      Config.Game.defaultAnimationDelay,
    );
    const size = Config.MazeSize[this.selectedSize];
    this.maze.resize(size, size);
    this.render();

    //maze and path events
    function updateUI() {
      that.redraw();
    }
    this.maze.onUpdateUI = function () {
      updateUI();
      that.updateProgress();
    };
    this.path.onUpdateUI = updateUI;

    //initialize the maze; when it's done, initialize the path
    this.maze.onInitComplete = function () {
      that.path.init(that.maze);
      that.updateCounters();
      that.playPart.style.display = "";
      that.setState(GameState.Playing);
    };
    this.prepareMaze();

    this.path.onPathComplete = function () {
      that.autoPath = true;
      that.updateCounters();
      that.setState(GameState.Finished);
    };
  },

  setState: function (state) {
    this.state = state;
    //drop any held arrow keys so they cannot resume movement in the next round
    this.stopMoving();
    this.updateToolbar();
  },

  updateToolbar: function () {
    const s = this.state;
    this.statusElement.innerHTML = s + "<span></span>";
    this.updateProgress();
    function setEnabled(element, enabled) {
      if (enabled) {
        element.removeClassName("disabled");
      } else {
        element.addClassName("disabled");
      }
    }
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
  },

  /* show the generation percentage next to the status text */
  updateProgress: function () {
    const element = this.statusElement.lastChild;
    if (!element) {
      return;
    }
    element.innerHTML =
      this.state == GameState.Generating
        ? " " + Math.floor(this.maze.getProgress() * 100) + "%"
        : "";
  },

  /* pick a new entrance and exit; the player goes back to the entrance */
  randomizeEntranceAndExit: function () {
    this.autoPath = false;
    this.path.randomEntranceAndExit();
    this.updateCounters();
    this.setState(GameState.Playing);
  },

  updateCounters: function () {
    //no entrance yet (Setup / Generating): getStepCount is null, and
    //Steps is not applicable, like Path Length before an auto solve
    const stepCount = this.path.getStepCount();
    $("counter-steps").innerHTML = stepCount == null ? "N/A" : stepCount;
    this.pathLengthElement.innerHTML = this.autoPath
      ? this.path.getPathLength()
      : "N/A";
  },

  render: function () {
    const that = this;

    //create the wrapper
    const rootElement = document.body;
    const wrapper = rootElement.createChild("div", {
      id: "game-wrapper",
      style: "padding: " + Config.Game.padding + "px",
    });

    //initialize the canvas and the context
    this.canvas = wrapper.createChild("canvas", {
      id: "game-canvas",
      width: 0,
      height: 0,
    });
    this.context = this.canvas.getContext("2d");
    this.bindPointer();

    //calculate the grid size and canvas size
    this.resizeCanvas();

    //check if the window size is changed
    function checkWindowsize() {
      const nwidth = document.documentElement.clientWidth;
      const nheight = document.documentElement.clientHeight;
      if (nwidth != that.width || nheight != that.height) {
        that.width = nwidth;
        that.height = nheight;
        that.resizeCanvas();
      }
    }
    setInterval(checkWindowsize, 200);

    //render the toolbar
    this.renderToolbar(rootElement);

    //keyboard events
    this.handleKeyEvent = function (e) {
      switch (e.type) {
        case "keydown":
          that.keyDown(e);
          break;
        case "keyup":
          that.keyUp(e);
          break;
      }
    };
    document.addEventListener("keydown", this.handleKeyEvent, false);
    document.addEventListener("keyup", this.handleKeyEvent, false);
  },

  renderToolbar: function (parent) {
    const that = this;

    //tool bar container
    const tools = parent.createChild("div", {
      style: "padding:" + Config.Game.padding + "px;",
      class: "toolbar",
    });
    tools.createChild("img", {
      src: "static/logo.png",
      width: 100,
      style: "margin: 0 0 6px 0",
    });
    tools.createChild(
      "div",
      { class: "toolbar-subtitle" },
      "A JavaScript maze game using Prim's algorithm for maze generation and A* for path finding.",
    );
    this.statusElement = this.newToolElement(
      this.newToolElement(tools, "|", false, null),
      "",
      true,
      null,
    );

    //separator
    this.newToolElement(tools, "-", false, null);

    //animation delays (applies to both maze generation and path finding)
    let line = this.newToolElement(tools, "|", false, null);
    this.newToolElement(line, "Animation: ", false, null);
    const animationDelays = Object.keys(Config.AnimationDelay.MazeGeneration);
    for (let i = 0; i < animationDelays.length; i++) {
      if (i > 0) {
        this.newToolElement(line, " ", false, null);
      }
      this.animationDelayButtons[animationDelays[i]] = this.newToolElement(
        line,
        animationDelays[i],
        false,
        (function (animationDelay) {
          return function () {
            that.setAnimationDelay(animationDelay);
            that.saveSetting("animationDelay", animationDelay);
          };
        })(animationDelays[i]),
      );
      this.animationDelayButtons[animationDelays[i]].addClassName("option");
      this.settingControls.push(this.animationDelayButtons[animationDelays[i]]);
    }

    //maze size
    line = this.newToolElement(tools, "|", false, null);
    this.newToolElement(line, "Maze Size: ", false, null);
    const sizes = Object.keys(Config.MazeSize);
    for (let i = 0; i < sizes.length; i++) {
      if (i > 0) {
        this.newToolElement(line, " ", false, null);
      }
      this.sizeButtons[sizes[i]] = this.newToolElement(
        line,
        sizes[i],
        false,
        (function (size) {
          return function () {
            that.resizeMaze(size);
            that.saveSetting("size", size);
          };
        })(sizes[i]),
      );
      this.sizeButtons[sizes[i]].addClassName("option");
      this.settingControls.push(this.sizeButtons[sizes[i]]);
    }
    this.setAnimationDelay(this.selectedAnimationDelay);
    this.markSelected(this.sizeButtons, this.selectedSize);

    //generate
    line = this.newToolElement(tools, "|", false, null);
    this.generateButton = this.newToolElement(
      line,
      "Generate Maze",
      false,
      function (e, obj) {
        that.resetMaze();
      },
    );
    this.newToolElement(line, " | ", false, null);
    this.randomButton = this.newToolElement(
      line,
      "New Entrance & Exit",
      false,
      function (e, obj) {
        that.randomizeEntranceAndExit();
      },
    );

    //move, show path and counter stay hidden until the first maze is generated
    const part = tools.createChild("div", {
      style: "display:none",
    });
    this.playPart = part;

    //separator
    this.newToolElement(part, "-", false, null);

    //find the route: by hand or by computer
    this.newToolElement(
      this.newToolElement(part, "|", false, null),
      "Solve the maze",
      true,
      null,
    );

    //by hand
    this.newToolElement(
      this.newToolElement(part, "|", false, null),
      "&nbsp;&nbsp;Manual - use arrow keys or drag",
      false,
      null,
    );
    line = this.newToolElement(part, "|", false, null);
    this.newToolElement(line, "&nbsp;&nbsp;&nbsp;&nbsp;Steps: ", false, null);
    line.createChild(
      "span",
      {
        id: "counter-steps",
        class: "highlighted",
      },
      "0",
    );

    //by computer
    line = this.newToolElement(part, "|", false, null);
    this.newToolElement(line, "&nbsp;&nbsp;Automatic - ", false, null);
    this.pathButton = this.newToolElement(
      line,
      "Show Path",
      false,
      function (e, obj) {
        that.getPath();
      },
    );
    line = this.newToolElement(part, "|", false, null);
    this.newToolElement(
      line,
      "&nbsp;&nbsp;&nbsp;&nbsp;Path Length: ",
      false,
      null,
    );
    this.pathLengthElement = line.createChild(
      "span",
      {
        class: "highlighted",
      },
      "N/A",
    );

    //footer: copyright and about
    const footer = tools.createChild("div", {
      class: "toolbar-footer",
    });
    footer.createChild("span", null, "Copyright \u00A9 QLike.com");
    this.newToolElement(footer, "About", false, function () {
      that.showAbout();
    });
  },

  /* modal dialog describing the game */
  showAbout: function () {
    if ($("about-overlay")) {
      return;
    }
    const overlay = document.body.createChild("div", {
      id: "about-overlay",
      class: "about-overlay",
    });
    const dialog = overlay.createChild("div", { class: "about-dialog" });
    dialog.createChild("h2", null, "About this Maze Game");
    dialog.createChild(
      "p",
      null,
      "This game is a JavaScript implementation of maze generation and A* path finding, drawn on an HTML5 canvas.",
    );
    dialog.createChild("h3", null, "Maze generation");
    dialog.createChild(
      "p",
      null,
      "The maze is a grid of cells separated by walls, all closed at the start. " +
        "The generator uses a randomized Prim's algorithm. It starts from a random cell and adds that cell's walls to a list. " +
        "It then repeatedly picks a random wall from the list. If the cells on both sides of the wall are already connected, " +
        "the wall is discarded to avoid a loop. Otherwise the wall is opened and the walls of the newly connected cell join the list. " +
        "The result is a perfect maze: it has no loops and no isolated areas, so there is exactly one route between any two cells.",
    );
    dialog.createChild("h3", null, "Path finding (A*)");
    dialog.createChild(
      "p",
      null,
      "A* always expands the most promising node, scored as F = G + H. G is the cost of the route from the entrance to the node, " +
        "and H is the straight-line distance from the node to the exit. Discovered nodes wait in the open area, and expanded nodes move to the closed area. " +
        "When the exit is reached, the route is traced back to the entrance through the parent links. " +
        "Turn on the animation to watch the open and closed areas spread.",
    );
    dialog.createChild("h3", null, "Source and feedback");
    dialog.createChild(
      "p",
      null,
      'GitHub: <a href="https://github.com/hui-w/maze" target="_blank">https://github.com/hui-w/maze</a><br>' +
        'Feedback: <a href="mailto:webmaster@qlike.com">webmaster@qlike.com</a>',
    );
    const close = function () {
      document.removeEventListener("keydown", onKey, false);
      document.body.removeChild(overlay);
    };
    const onKey = function (e) {
      if (e.keyCode == 27) {
        close();
      }
    };
    document.addEventListener("keydown", onKey, false);
    overlay.onclick = function (e) {
      if (e.target == overlay) {
        close();
      }
    };
    const button = dialog.createChild("div", { class: "about-actions" });
    const closeButton = button.createChild(
      "span",
      { class: "toolbar-linkbutton about-close" },
      "Close",
    );
    closeButton.onclick = close;
  },

  newToolElement: function (parent, text, highlight, handler) {
    let element = null;
    if (text == "|") {
      //new line
      element = parent.createChild("div", {
        class: "toolbar-line",
      });
    } else if (text == "-") {
      //separator line
      element = parent.createChild("div", {
        class: "toolbar-separator",
      });
    } else if (handler == null) {
      //normal text
      element = parent.createChild(
        "span",
        {
          class: "toolbar-text",
        },
        text,
      );
    } else {
      //link button
      element = parent.createChild(
        "span",
        {
          class: "toolbar-linkbutton",
        },
        text,
      );
      element.onclick = function (e) {
        if (this.hasClassName("disabled") || this.hasClassName("selected")) {
          return;
        }
        handler(e, this);
      };
    }
    if (highlight) {
      element.addClassName("highlighted");
    }
    return element;
  },

  /* localStorage may be unavailable (private mode); fall back to the default */
  loadSetting: function (key, allowed, fallback) {
    try {
      const value = localStorage.getItem("maze." + key);
      if (value && allowed.hasOwnProperty(value)) {
        return value;
      }
    } catch (e) {}
    return fallback;
  },

  saveSetting: function (key, value) {
    try {
      localStorage.setItem("maze." + key, value);
    } catch (e) {}
  },

  /* the chosen option is highlighted and no longer clickable */
  markSelected: function (buttons, value) {
    for (let key in buttons) {
      if (key == value) {
        buttons[key].addClassName("selected");
      } else {
        buttons[key].removeClassName("selected");
      }
    }
  },

  /* A zero delay skips animation; other options use their configured delays */
  setAnimationDelay: function (animationDelay) {
    Config.Maze.stepDelay =
      Config.AnimationDelay.MazeGeneration[animationDelay];
    Config.Path.stepDelay = Config.AnimationDelay.PathFinding[animationDelay];
    this.markSelected(this.animationDelayButtons, animationDelay);
  },

  resizeMaze: function (size) {
    const n = Config.MazeSize[size];
    this.maze.resize(n, n);
    this.markSelected(this.sizeButtons, size);
    this.resizeCanvas();
    this.prepareMaze();
  },

  /* show an empty maze (all walls closed) and wait for Generate Maze */
  prepareMaze: function () {
    this.autoPath = false;
    this.path.init();
    this.maze.prepare();
    this.updateCounters();
    this.setState(GameState.Setup);
    this.redraw();
  },

  /* keyboard events: key down */
  keyDown: function (e) {
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
    }
    this.startMoving();
  },

  /* move the player in the held directions, and repeat until all directions are released */
  startMoving: function () {
    const that = this;
    if (this.arrowKeyStatus == 0 || this.keyboardTimer != null) {
      return;
    }
    function keyboardTimerHandler() {
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

        //set-up the timer for next round
        that.keyboardTimer = setTimeout(
          keyboardTimerHandler,
          Config.Game.keyboardTimerDelay,
        );
      } else {
        that.keyboardTimer = null;
      }
    }
    keyboardTimerHandler();
  },

  /* touch and mouse: press anywhere on the maze and drag; the player moves in the drag direction while held */
  bindPointer: function () {
    const that = this;
    const canvas = this.canvas;
    let activePointer = null;
    let startX = 0;
    let startY = 0;

    function update(e) {
      if (that.state != GameState.Playing) {
        that.stopMoving();
        return;
      }
      let dx = e.clientX - startX;
      let dy = e.clientY - startY;

      //the press point trails behind the finger, so changing direction only needs a short drag
      const max = Config.Game.dragThreshold * 3;
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
        Math.abs(dx) < Config.Game.dragThreshold &&
        Math.abs(dy) < Config.Game.dragThreshold
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
    }

    function release(e) {
      if (activePointer == e.pointerId) {
        activePointer = null;
        that.stopMoving();
      }
    }

    canvas.addEventListener("pointerdown", function (e) {
      if (that.state != GameState.Playing || activePointer != null) {
        return;
      }
      activePointer = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (activePointer == e.pointerId) {
        update(e);
      }
    });
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
  },

  stopMoving: function () {
    this.arrowKeyStatus = 0;
    if (this.keyboardTimer != null) {
      clearTimeout(this.keyboardTimer);
      this.keyboardTimer = null;
    }
  },

  /* keyboard events: key up */
  keyUp: function (e) {
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
  },

  resizeCanvas: function () {
    const wrapperWidth = this.width - Config.Game.padding * 2;
    const wrapperHeight = this.height - Config.Game.padding * 2;
    //fractional cell size so the board always fills the available space
    const boardWidth = Math.floor(wrapperWidth);
    const boardHeight = Math.floor(wrapperHeight);
    this.cellSize = Math.min(
      boardWidth / this.maze.cols,
      boardHeight / this.maze.rows,
    );

    //back the canvas with device pixels so lines stay sharp on high-DPI screens
    const ratio = window.devicePixelRatio || 1;
    this.canvasWidth = Math.round(this.maze.cols * this.cellSize);
    this.canvasHeight = Math.round(this.maze.rows * this.cellSize);
    this.canvas.width = Math.round(this.canvasWidth * ratio);
    this.canvas.height = Math.round(this.canvasHeight * ratio);
    this.canvas.style.width = this.canvasWidth + "px";
    this.canvas.style.height = this.canvasHeight + "px";
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);

    this.redraw();
  },

  redraw: function () {
    //draw the background
    this.context.save();
    this.context.fillStyle = Config.Game.backgroundColor;
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.context.restore();

    //draw the maze and path
    this.maze.redraw(this.context, this.cellSize);
    this.path.redraw(this.context, this.cellSize);
  },

  resetMaze: function () {
    this.autoPath = false;
    this.setState(GameState.Generating);
    this.path.init(); //initialize without maze will clear current path content immediately
    this.maze.init(); //the path will be initialized when the maze initComplete
    this.updateCounters();
  },

  getPath: function () {
    if (this.state != GameState.Playing) {
      return;
    }
    this.setState(GameState.Solving);
    this.path.getPath();
  },

  moveStep: function (dRow, dCol) {
    if (this.state != GameState.Playing) {
      return;
    }
    this.path.moveStep(dRow, dCol);
    this.updateCounters();
    if (this.path.isAtExit()) {
      this.setState(GameState.Finished);
    }
  },
};

let game = null;
addEventListener("load", function () {
  game = new Game();
});
