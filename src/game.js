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
    if (typeof G_vmlCanvasManager != "undefined") {
      this.canvas = G_vmlCanvasManager.initElement(this.canvas);
    }
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
    this.newToolElement(line, "Animation - ", false, null);
    line.createChild(
      "span",
      {
        id: "animation-speed",
        class: "highlighted",
      },
      "OFF",
    );
    this.newToolElement(line, " [", false, null);
    var speeds = ["OFF", "Fast", "Medium", "Slow"];
    for (var i = 0; i < speeds.length; i++) {
      if (i > 0) {
        this.newToolElement(line, " ", false, null);
      }
      this.settingControls.push(
        this.newToolElement(
          line,
          speeds[i],
          false,
          (function (speed) {
            return function () {
              that.setAnimationSpeed(speed);
            };
          })(speeds[i]),
        ),
      );
    }
    this.newToolElement(line, "]", false, null);

    //maze size
    line = this.newToolElement(tools, "|", false, null);
    this.newToolElement(line, "Maze Size - ", false, null);
    line.createChild(
      "span",
      {
        id: "maze-size",
        class: "highlighted",
      },
      "XS",
    );
    this.newToolElement(line, " [", false, null);
    var sizes = ["XS", "S", "M", "L", "XL"];
    for (var i = 0; i < sizes.length; i++) {
      if (i > 0) {
        this.newToolElement(line, " ", false, null);
      }
      this.settingControls.push(
        this.newToolElement(
          line,
          sizes[i],
          false,
          (function (size) {
            return function () {
              that.resizeMaze(size);
            };
          })(sizes[i]),
        ),
      );
    }
    this.newToolElement(line, "]", false, null);

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

    tools.createChild(
      "div",
      {
        class: "toolbar-footer",
      },
      "Copyright (C) QLike.com",
    );
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
        if (this.hasClassName("disabled")) {
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

  /* Medium keeps the original step delays; Fast and Slow scale them */
  setAnimationSpeed: function (speed) {
    var scale = { Slow: 2, Medium: 1, Fast: 0.1 }[speed];
    Config.Maze.showStep = Config.Path.showStep = scale != null;
    if (scale != null) {
      Config.Maze.stepDelay = this.baseDelay.maze * scale;
      Config.Path.stepDelay = this.baseDelay.path * scale;
    }
    $("animation-speed").innerHTML = speed;
  },

  resizeMaze: function (size) {
    switch (size) {
      case "XS":
        this.maze.rows = 16;
        this.maze.cols = 16;
        break;
      case "S":
        this.maze.rows = 24;
        this.maze.cols = 24;
        break;
      case "M":
        this.maze.rows = 32;
        this.maze.cols = 32;
        break;
      case "L":
        this.maze.rows = 48;
        this.maze.cols = 48;
        break;
      case "XL":
        this.maze.rows = 64;
        this.maze.cols = 64;
        break;
    }

    $("maze-size").innerHTML = size;
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
    var keyCode = event.keyCode;
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
    var keyCode = event.keyCode;
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
    var rateWidth = wrapperWidth / this.maze.rows;
    var rateHeight = wrapperHeight / this.maze.cols;
    if (rateWidth > rateHeight) {
      this.cellSize = Math.floor(rateHeight);
    } else {
      this.cellSize = Math.floor(rateWidth);
    }

    this.canvas.width = this.maze.rows * this.cellSize;
    this.canvas.height = this.maze.cols * this.cellSize;

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
