/** 
* @author Wang, Hui (huiwang@qlike.com) 
* @repo https://github.com/hui-w/maze
* @licence MIT 
*/ 
function Maze(rows, cols) {
	this.rows = rows;
	this.cols = cols;
	this.cells = [];
	this.walls = [];
	this.tempWalls = []; //walls to handle when generating maze

	this.onUpdateUI = null;
	this.onInitComplete = null;
}

Maze.prototype = {
	updateUI : function () {
		if (typeof this.onUpdateUI == "function") {
			this.onUpdateUI();
		}
	},

	initComplete : function () {
		if (typeof this.onInitComplete == "function") {
			this.onInitComplete();
		}
	},

	init : function () {
		//clear old values
		this.cells = [];
		this.walls = [];

		//prepare all the cells
		for (var row = 0; row < this.rows; row++) {
			for (var col = 0; col < this.cols; col++) {
				var cell = new Cell(row, col);
				this.cells.push(cell);
			}
		}

		//prepare all the walls
		this.generateWalls();

		//generate the maze
		this.generateMaze();
	},

	generateWalls : function () {
		for (var i = 0; i < this.rows * this.cols; i++) {
			if (i / this.rows < this.cols - 1) {
				//horizontal walls
				var cellA = this.cells[i];
				var cellB = this.cells[i + this.rows];
				var wall = new Wall(cellA, cellB);
				this.walls.push(wall);

				cellA.walls.push(wall);
				cellB.walls.push(wall);
			}

			if (i % this.rows < this.rows - 1) {
				//vertical walls
				var cellA = this.cells[i];
				var cellB = this.cells[i + 1];
				var wall = new Wall(cellA, cellB);
				this.walls.push(wall);

				cellA.walls.push(wall);
				cellB.walls.push(wall);
			}
		}
	},

	/* Randomized PRIM's algorithm */
	generateMaze : function () {
		var that = this;
		this.tempWalls = [];

		//start from the any wall
		this.fetchClosingWalls(this.tempWalls, this.cells[rand(0, this.cells.length)]);

		if (!Config.Maze.showStep) {
			while (this.tempWalls.length > 0) {
				this.processRandomWall(false);
			}
			this.updateUI();
			this.initComplete();
		} else {
			//run step by step
			function runStep() {
				if (that.tempWalls.length > 0) {
					that.processRandomWall(true);
					setTimeout(runStep, Config.Maze.stepDelay);
				} else {
					//end
					that.initComplete();
				}
			}
			runStep();
		}
	},

	processRandomWall : function (updateStep) {
		var randIdx = rand(0, this.tempWalls.length - 1);
		//pick a random wall from the list
		var wall = this.tempWalls[randIdx];
		var cellA = wall.cellA;
		var cellB = wall.cellB;
		if (cellA.connected && cellB.connected) {
			//cells connected, remove the wall from the temp array
			this.tempWalls.removeAt(randIdx);
		} else {
			//not connected, connect the cells
			wall.setOpen(true);

			if (updateStep) {
				this.updateUI();
			}

			//add the closing wall to the temp list
			if (cellA.connected) {
				this.fetchClosingWalls(this.tempWalls, cellB);
			} else if (cellB.connected) {
				this.fetchClosingWalls(this.tempWalls, cellA);
			}
		}
	},

	fetchClosingWalls : function (walls, cell) {
		//set the cell as connected
		cell.setConnected(true);

		//get all the closing walls, and add them into the temp list
		for (var i = 0; i < cell.walls.length; i++) {
			var wall = cell.walls[i];
			if (!wall.isOpen) {
				walls.push(wall);
			}
		}
	},

	redraw : function (context, cellSize) {
		function drawRectangle(context, cell, cellSize, withPadding) {
			var padding = withPadding ? cellSize * 0.1 : 0;
			context.rect(cell.col * cellSize + padding, cell.row * cellSize + padding, cellSize - 2 * padding, cellSize - 2 * padding);
		}

		context.save();
		context.lineWidth = 1;

		//walls
		context.beginPath();
		for (var i = 0; i < this.walls.length; i++) {
			if (this.walls[i].isOpen) {
				continue;
			}
			var wall = this.walls[i];
			var x = wall.cellB.col * cellSize;
			var y = wall.cellB.row * cellSize;

			if (wall.cellA.row == wall.cellB.row) {
				//vertical wall
				context.antiFuzzyLine(x, y, x, y + cellSize);
			} else {
				//horizontal walls
				context.antiFuzzyLine(x, y, x + cellSize, y);
			}
		}

		//canvas borders
		context.antiFuzzyLine(0, 1, this.cols * cellSize, 1); //special treated for 1px line from (0, 0, this.canvas.width, 0)
		context.antiFuzzyLine(this.cols * cellSize, 0, this.cols * cellSize, this.rows * cellSize);
		context.antiFuzzyLine(this.cols * cellSize, this.rows * cellSize, 0, this.rows * cellSize);
		context.antiFuzzyLine(1, this.rows * cellSize, 1, 0); //special treated for 1px line from (0, this.canvas.height, 0, 0)
		context.strokeStyle = Config.Maze.wallColor;
		context.stroke();

		//temp walls
		if (Config.Maze.showStep) {
			context.beginPath();
			//walls
			for (var i = 0; i < this.tempWalls.length; i++) {
				var wall = this.tempWalls[i];

				//wall
				var x = wall.cellB.col * cellSize;
				var y = wall.cellB.row * cellSize;
				if (wall.cellA.row == wall.cellB.row) {
					//vertical wall
					context.antiFuzzyLine(x, y, x, y + cellSize);
				} else {
					//horizontal walls
					context.antiFuzzyLine(x, y, x + cellSize, y);
				}
			}
			context.strokeStyle = Config.Maze.highlightedWallColor;
			context.stroke();

			//cells
			context.beginPath();
			for (var i = 0; i < this.tempWalls.length; i++) {
				var wall = this.tempWalls[i];

				//cells
				drawRectangle(context, wall.cellA, cellSize, false);
				drawRectangle(context, wall.cellB, cellSize, false);
			}
			context.fillStyle = Config.Maze.highlightedCellColor;
			context.fill();
		}

		context.restore();
	}
}

function Wall(cellA, cellB) {
	this.cellA = cellA;
	this.cellB = cellB;
	this.isOpen = false;
}

Wall.prototype = {
	setOpen : function (isOpen) {
		this.isOpen = isOpen;
	},

	getOtherCell : function (cell) {
		if (cell.row == this.cellA.row && cell.col == this.cellA.col) {
			return this.cellB;
		} else if (cell.row == this.cellB.row && cell.col == this.cellB.col) {
			return this.cellA;
		} else {
			return null;
		}
	}
}

function Cell(row, col) {
	this.row = row;
	this.col = col;
	this.connected = false;
	this.walls = [];
}

Cell.prototype = {
	setConnected : function (connected) {
		this.connected = connected;
	}
}
