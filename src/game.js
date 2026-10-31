/**
 * @author Wang, Hui (huiwang@qlike.com)
 * @repo https://github.com/hui-w/maze
 * @licence MIT
 */
var GameState = {
  Setup: "Select a size and generate maze",
  Generating: "Generating maze...",
  Playing: "Maze is ready - Find the route now",
  Solving: "Finding the path...",
  Finished: "Route complete",
};

function Game() {
  this.maze = new Maze(Config.Maze.rows, Config.Maze.cols);
  this.path = new Path();
  this.state = GameState.Setup;
  this.settingControls = [];
  this.speedButtons = {};
  this.sizeButtons = {};
  this.statusElement = null;
  this.pathButton = null;
  this.generateButton = null;
  this.randomButton = null;
  this.baseDelay = {
    maze: Config.Maze.stepDelay,
    path: Config.Path.stepDelay,
  };
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
    var that = this;
    this.width = document.documentElement.clientWidth;
    this.height = document.documentElement.clientHeight;
    this.render();

    //maze and path events
    function updateUI() {
      that.redraw();
    }
    this.maze.onUpdateUI = updateUI;
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
    this.arrowKeyStatus = 0;
    if (this.keyboardTimer != null) {
      clearTimeout(this.keyboardTimer);
      this.keyboardTimer = null;
    }
    this.updateToolbar();
  },

  updateToolbar: function () {
    var s = this.state;
    this.statusElement.innerHTML = s;
    function setEnabled(element, enabled) {
      if (enabled) {
        element.removeClassName("disabled");
      } else {
        element.addClassName("disabled");
      }
    }
    for (var i = 0; i < this.settingControls.length; i++) {
      //only locked while an animation is running
      setEnabled(
        this.settingControls[i],
        s != GameState.Generating && s != GameState.Solving,
      );
    }
    setEnabled(
      this.generateButton,
      s == GameState.Setup ||
        s == GameState.Playing ||
        s == GameState.Finished,
    );
    setEnabled(
      this.randomButton,
      s == GameState.Playing || s == GameState.Finished,
    );
    setEnabled(this.pathButton, s == GameState.Playing);
  },

  /* pick a new entrance and exit; the player goes back to the entrance */
  randomizeEntranceAndExit: function () {
    this.autoPath = false;
    this.path.randomEntranceAndExit();
    this.updateCounters();
    this.setState(GameState.Playing);
  },

  updateCounters: function () {
    $("counter-steps").innerHTML = this.path.stepCounter;
    this.pathLengthElement.innerHTML = this.autoPath
      ? this.path.getPathLength()
      : "N/A";
  },

  render: function () {
    var that = this;

    //create the wrapper
    var rootElement = document.body;
    var wrapper = rootElement.createChild("div", {
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

    //calculate the grid size and canvas size
    this.resizeCanvas();

    //check if the window size is changed
    function checkWindowsize() {
      var nwidth = document.documentElement.clientWidth;
      var nheight = document.documentElement.clientHeight;
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
    var that = this;

    //tool bar container
    var tools = parent.createChild("div", {
      style: "padding:" + Config.Game.padding + "px;",
      class: "toolbar",
    });
    tools.createChild("img", {
      src: "static/logo.png",
      width: 100,
      style: "margin: 0 0 10px 0",
    });
    this.statusElement = this.newToolElement(
      this.newToolElement(tools, "|", false, null),
      "",
      true,
      null,
    );

    //separator
    this.newToolElement(tools, "-", false, null);

    //animation speed (applies to both maze generation and path finding)
    var line = this.newToolElement(tools, "|", false, null);
    this.newToolElement(line, "Animation: ", false, null);
    var speeds = ["OFF", "FAST", "NORMAL", "SLOW"];
    for (var i = 0; i < speeds.length; i++) {
      if (i > 0) {
        this.newToolElement(line, " ", false, null);
      }
      this.speedButtons[speeds[i]] = this.newToolElement(
        line,
        speeds[i],
        false,
        (function (speed) {
          return function () {
            that.setAnimationSpeed(speed);
          };
        })(speeds[i]),
      );
      this.speedButtons[speeds[i]].addClassName("option");
      this.settingControls.push(this.speedButtons[speeds[i]]);
    }

    //maze size
    line = this.newToolElement(tools, "|", false, null);
    this.newToolElement(line, "Maze Size: ", false, null);
    var sizes = ["XXS", "XS", "S", "M", "L", "XL"];
    for (var i = 0; i < sizes.length; i++) {
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
          };
        })(sizes[i]),
      );
      this.sizeButtons[sizes[i]].addClassName("option");
      this.settingControls.push(this.sizeButtons[sizes[i]]);
    }
    this.setAnimationSpeed("FAST");
    this.markSelected(this.sizeButtons, "XS");

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
      "Random Entrance & Exit",
      false,
      function (e, obj) {
        that.randomizeEntranceAndExit();
      },
    );

    //move, show path and counter stay hidden until the first maze is generated
    var part = tools.createChild("div", {
      style: "display:none",
    });
    this.playPart = part;

    //separator
    this.newToolElement(part, "-", false, null);

    //find the route: by hand or by computer
    this.newToolElement(
      this.newToolElement(part, "|", false, null),
      "Find the route",
      true,
      null,
    );

    //by hand
    this.newToolElement(
      this.newToolElement(part, "|", false, null),
      "&nbsp;&nbsp;By hand - use keyboard arrows",
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
    this.newToolElement(line, "&nbsp;&nbsp;By computer - ", false, null);
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
    var footer = tools.createChild("div", {
      class: "toolbar-footer",
    });
    footer.createChild("span", null, "Copyright (C) QLike.com");
    this.newToolElement(footer, "About", false, function () {
      that.showAbout();
    });
  },

  /* modal dialog describing the game */
  showAbout: function () {
    if ($("about-overlay")) {
      return;
    }
    var overlay = document.body.createChild("div", {
      id: "about-overlay",
      class: "about-overlay",
    });
    var dialog = overlay.createChild("div", { class: "about-dialog" });
    dialog.createChild("h2", null, "About This Implementation");
    dialog.createChild(
      "p",
      null,
      "The maze on QLike.com is a JavaScript implementation of a maze generation algorithm and A* path finding, drawn on an HTML5 canvas.",
    );
    dialog.createChild("h3", null, "Maze generation");
    dialog.createChild(
      "p",
      null,
      "The maze is a grid of cells separated by walls, all closed at the start. " +
        "The generator uses a randomized Prim's algorithm: pick a random cell and add its walls to a list, " +
        "then repeatedly pick a random wall from the list. If the cells on both sides are already connected, " +
        "the wall is discarded to avoid a loop; otherwise it is opened and the walls of the newly connected cell are added to the list. " +
        "The result is a perfect maze with no loops and no isolated areas, so there is exactly one route between any two cells.",
    );
    dialog.createChild("h3", null, "Path finding (A*)");
    dialog.createChild(
      "p",
      null,
      "A* always expands the most promising node, scored as F = G + H, where G is the cost already travelled from the entrance " +
        "and H is the straight-line distance to the exit. Discovered nodes wait in the open area; expanded nodes move to the closed area. " +
        "When the exit is reached, the route is rebuilt by following the parent links back to the entrance. " +
        "Turn animation on to watch the open and closed areas spread.",
    );
    dialog.createChild("h3", null, "Source and contact");
    dialog.createChild(
      "p",
      null,
      'GitHub: <a href="https://github.com/hui-w/maze" target="_blank">https://github.com/hui-w/maze</a><br>' +
        'Contact: <a href="mailto:webmaster@qlike.com">webmaster@qlike.com</a>',
    );
    var close = function () {
      document.removeEventListener("keydown", onKey, false);
      document.body.removeChild(overlay);
    };
    var onKey = function (e) {
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
    var button = dialog.createChild("div", { class: "about-actions" });
    var closeButton = button.createChild(
      "span",
      { class: "toolbar-linkbutton about-close" },
      "Close",
    );
    closeButton.onclick = close;
  },

  newToolElement: function (parent, text, highlight, handler) {
    var element = null;
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

  /* the chosen option is highlighted and no longer clickable */
  markSelected: function (buttons, value) {
    for (var key in buttons) {
      if (key == value) {
        buttons[key].addClassName("selected");
      } else {
        buttons[key].removeClassName("selected");
      }
    }
  },

  /* Normal keeps the original step delays, Slow quadruples them, Fast is 4ms (the browser timer minimum) */
  setAnimationSpeed: function (speed) {
    var scale = { SLOW: 4, NORMAL: 1, FAST: 0 }[speed];
    Config.Maze.showStep = Config.Path.showStep = scale != null;
    if (scale != null) {
      Config.Maze.stepDelay = scale ? this.baseDelay.maze * scale : 4;
      Config.Path.stepDelay = scale ? this.baseDelay.path * scale : 4;
    }
    this.markSelected(this.speedButtons, speed);
  },

  resizeMaze: function (size) {
    var n = { XXS: 8, XS: 16, S: 24, M: 32, L: 48, XL: 64 }[size];
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
    var that = this;
    var keyCode = e.keyCode;
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
    if (this.arrowKeyStatus > 0 && this.keyboardTimer == null) {
      keyboardTimerHandler();
    }

    function keyboardTimerHandler() {
      var dRow = 0;
      var dCol = 0;
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
  },

  /* keyboard events: key up */
  keyUp: function (e) {
    var keyCode = e.keyCode;
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
    var wrapperWidth = this.width - Config.Game.padding * 2;
    var wrapperHeight = this.height - Config.Game.padding * 2;
    //fractional cell size so the board always fills the available space
    var boardWidth = Math.floor(wrapperWidth);
    var boardHeight = Math.floor(wrapperHeight);
    this.cellSize = Math.min(
      boardWidth / this.maze.cols,
      boardHeight / this.maze.rows,
    );

    this.canvas.width = Math.round(this.maze.cols * this.cellSize);
    this.canvas.height = Math.round(this.maze.rows * this.cellSize);

    this.redraw();
  },

  redraw: function () {
    //draw the background
    this.context.save();
    this.context.fillStyle = Config.Game.backgroundColor;
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
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

var game = null;
addEventListener("load", function () {
  game = new Game();
});
