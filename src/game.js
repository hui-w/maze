/** 
* @author Wang, Hui (huiwang@qlike.com) 
* @repo https://github.com/hui-w/maze
* @licence MIT 
*/ 
function Game() {
	this.maze = new Maze(Config.Maze.rows, Config.Maze.cols);
	this.path = new Path();

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
	init : function () {
		var that = this;
		this.width = document.documentElement.clientWidth;
		this.height = document.documentElement.clientHeight;
		this.render();

		//maze and path events
		function updateUI() {
			that.redraw();
		};
		this.maze.onUpdateUI = updateUI;
		this.path.onUpdateUI = updateUI;

		//initialize the maze; when it's done, initialize the path
		this.maze.onInitComplete = function () {
			that.path.init(that.maze);
		};
		this.maze.init();

		this.path.onPathComplete = function () {
			$("step-counter-auto").innerHTML = this.getPathLength();
		};
	},

	render : function () {
		var that = this;

		//create the wrapper
		var rootElement = document.body;
		var wrapper = rootElement.createChild("div", {
				"id" : "game-wrapper",
				"style" : "padding: " + Config.Game.padding + "px"
			})

			//initialize the canvas and the context
			this.canvas = wrapper.createChild("canvas", {
				"id" : "game-canvas",
				"width" : 0,
				"height" : 0
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
		}
		document.addEventListener("keydown", this.handleKeyEvent, false);
		document.addEventListener("keyup", this.handleKeyEvent, false);
	},

	renderToolbar : function (parent) {
		var that = this;

		//tool bar container
		var tools = parent.createChild("div", {
				"style" : "padding:" + Config.Game.padding + "px;",
				"class" : "toolbar"
			});
		this.newToolElement(this.newToolElement(tools, "|", false, null), "How to play:", true, null);

		//separator
		this.newToolElement(tools, "-", false, null);

		//new maze
		this.newToolElement(this.newToolElement(tools, "|", false, null), "1) Reset Maze", false, function (e, obj) {
			that.resetMaze();
		});
		this.newToolElement(this.newToolElement(tools, "|", false, null), "&nbsp;&nbsp;&nbsp;&nbsp;(Initialize a maze)", false, null);

		//maze step
		var line = this.newToolElement(tools, "|", false, null);
		this.newToolElement(line, "&nbsp;&nbsp;&nbsp;&nbsp;Show Step by Step - ", false, null);
		this.newToolElement(line, Config.Maze.showStep ? "ON" : "OFF", false, function (e, obj) {
			Config.Maze.showStep = !Config.Maze.showStep;
			obj.innerHTML = Config.Maze.showStep ? "ON" : "OFF";
		});

		//maze size
		var line = this.newToolElement(tools, "|", false, null);
		this.newToolElement(line, "&nbsp;&nbsp;&nbsp;&nbsp;Maze Size - ", false, null);
		line.createChild("span", {
			"id" : "maze-size",
			"class" : "highlighted"
		}, "M");
		this.newToolElement(line, " [", false, null);
		this.newToolElement(line, "XS", false, function (e, obj) {
			that.resizeMaze("XS");
		});
		this.newToolElement(line, " ", false, null);
		this.newToolElement(line, "S", false, function (e, obj) {
			that.resizeMaze("S");
		});
		this.newToolElement(line, " ", false, null);
		this.newToolElement(line, "M", false, function (e, obj) {
			that.resizeMaze("M");
		});
		this.newToolElement(line, " ", false, null);
		this.newToolElement(line, "L", false, function (e, obj) {
			that.resizeMaze("L");
		});
		this.newToolElement(line, " ", false, null);
		this.newToolElement(line, "XL", false, function (e, obj) {
			that.resizeMaze("XL");
		});
		this.newToolElement(line, "] ", false, null);

		//change entrance and exit
		this.newToolElement(this.newToolElement(tools, "|", false, null), "2) Entrance & Exit", false, function (e, obj) {
			that.resetEntranceAndExit();
		});
		line = this.newToolElement(tools, "|");
		this.newToolElement(this.newToolElement(tools, "|", false, null), "&nbsp;&nbsp;&nbsp;&nbsp;(Get randomized start and end points)", false, null);

		//move
		this.newToolElement(this.newToolElement(tools, "|", false, null), "3) Move", false, null);
		this.newToolElement(this.newToolElement(tools, "|", false, null), "&nbsp;&nbsp;&nbsp;&nbsp;(Use keyboard arrows to control)", false, null);

		//show path
		this.newToolElement(this.newToolElement(tools, "|", false, null), "4) Show Path", false, function (e, obj) {
			that.getPath();
		});
		this.newToolElement(this.newToolElement(tools, "|", false, null), "&nbsp;&nbsp;&nbsp;&nbsp;(Let the computer find the path for you)", false, null);

		//path step
		line = this.newToolElement(tools, "|", false, null);
		this.newToolElement(line, "&nbsp;&nbsp;&nbsp;&nbsp;Show Step by Step - ", false, null);
		this.newToolElement(line, Config.Path.showStep ? "ON" : "OFF", false, function (e, obj) {
			Config.Path.showStep = !Config.Path.showStep;
			obj.innerHTML = Config.Path.showStep ? "ON" : "OFF";
			that.redraw();
		});

		//separator
		this.newToolElement(tools, "-", false, null);
		line = this.newToolElement(tools, "|", false, null);
		this.newToolElement(line, "Step Counter: ", false, null);
		line.createChild("span", {
			"id" : "step-counter-manual",
			"class" : "highlighted"
		}, "0");
		line = this.newToolElement(tools, "|", false, null);
		this.newToolElement(line, "Auto Path Length: ", false, null);
		line.createChild("span", {
			"id" : "step-counter-auto",
			"class" : "highlighted"
		}, "-1");
		
		this.newToolElement(tools, "-", false, null);
		line = this.newToolElement(tools, "|", false, null);
		this.newToolElement(line, "Copyright (C) QLike.com", false, null);
	},

	newToolElement : function (parent, text, highlight, handler) {
		var element = null;
		if (text == "|") {
			//new line
			element = parent.createChild("div", {
					"class" : "toolbar-line"
				});
		} else if (text == "-") {
			//separator line
			element = parent.createChild("div", {
					"class" : "toolbar-separator"
				});
		} else if (handler == null) {
			//normal text
			element = parent.createChild("span", {
					"class" : "toolbar-text"
				}, text);
		} else {
			//link button
			element = parent.createChild("span", {
					"class" : "toolbar-linkbutton"
				}, text);
			element.onclick = function (e) {
				handler(e, this);
			}
		}
		if (highlight) {
			element.addClassName("highlighted");
		}
		return element;
	},

	resizeMaze : function (size) {
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
		this.resetMaze();
	},

	/* keyboard events: key down */
	keyDown : function (e) {
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
				that.keyboardTimer = setTimeout(keyboardTimerHandler, Config.Game.keyboardTimerDelay);
			} else {
				that.keyboardTimer = null;
			}

		};
	},

	/* keyboard events: key up */
	keyUp : function (e) {
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

	resizeCanvas : function () {
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

	redraw : function () {
		//draw the background
		this.context.save();
		this.context.fillStyle = Config.Game.backgroundColor;
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.context.restore();

		//draw the maze and path
		this.maze.redraw(this.context, this.cellSize);
		this.path.redraw(this.context, this.cellSize);
	},

	resetMaze : function () {
		this.path.init(); //initialize without maze will clear current path content immediately
		this.maze.init(); //the path will be initialized when the maze initComplete
		$("step-counter-manual").innerHTML = this.path.stepCounter;
		$("step-counter-auto").innerHTML = this.path.getPathLength();
	},

	resetEntranceAndExit : function () {
		this.path.randomEntranceAndExit();
		$("step-counter-manual").innerHTML = this.path.stepCounter;
		$("step-counter-auto").innerHTML = this.path.getPathLength();
	},

	getPath : function () {
		this.path.getPath();
	},

	moveStep : function (dRow, dCol) {
		this.path.moveStep(dRow, dCol);
		$("step-counter-manual").innerHTML = this.path.stepCounter;
	}
}

var game = null;
addEventListener("load", function () {
	game = new Game();
});
