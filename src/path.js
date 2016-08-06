/** 
* @author Wang, Hui (huiwang@qlike.com) 
* @repo https://github.com/hui-w/maze
* @licence MIT 
*/ 
function Path() {
	this.maze = null;

	this.openArea = [];
	this.closeArea = {};
	this.cache = {};
	this.entranceNode = null;
	this.exitNode = null;
	this.stepNode = null;
	this.fMinNode = null;
	this.path = [];

	this.onUpdateUI = null;
	this.onPathComplete = null;

	this.stepCounter = 0;
}

Path.prototype = {
	updateUI : function () {
		if (typeof this.onUpdateUI == "function") {
			this.onUpdateUI();
		}
	},

	pathComplete : function () {
		if (this.pathFound()) {
			//full path
			this.path.push({
				row : this.exitNode.row,
				col : this.exitNode.col
			});

			var node = this.exitNode.prev;
			while (node !== this.entranceNode) {
				this.path.push({
					row : node.row,
					col : node.col
				});
				node = node.prev;
			}
			this.path.push({
				row : this.entranceNode.row,
				col : this.entranceNode.col
			});
		}

		//refresh the UI
		this.updateUI();

		if (typeof this.onPathComplete == "function") {
			this.onPathComplete();
		}
	},

	/* initialize without maze object  will only cleat the contents and refresh the UI*/
	init : function (maze) {
		this.cache = {};
		this.entranceNode = null;
		this.exitNode = null;
		this.stepNode = null;
		this.fMinNode = null;
		this.openArea = [];
		this.closeArea = {};
		this.path = [];
		this.stepCounter = 0;

		if (maze != null) {
			this.maze = maze;
			//prepare the nodes cache
			var cells = maze.cells;
			for (var i = 0; i < cells.length; i++) {
				var cell = cells[i];
				var node = new AStarNode(cell.row, cell.col);

				for (var j = 0; j < cell.walls.length; j++) {
					var wall = cell.walls[j];
					if (wall.isOpen) {
						var otherCell = wall.getOtherCell(cell);
						node.neighbors.push({
							row : otherCell.row,
							col : otherCell.col
						});
					}
				}
				this.cache[node.id] = node;
			}

			//get a randomized entrance and exit
			this.randomEntranceAndExit();
		} else {
			//update the UI when resetting
			this.updateUI();
		}
	},

	getPath : function () {
		var that = this;
		if (this.entranceNode == null || this.exitNode == null) {
			return;
		}

		this.path = [];

		//reset the temp variables
		this.openArea = [];
		this.closeArea = {};

		/* start */
		this.neighboursIntoOpenArea(this.entranceNode);
		if (this.openArea.length == 0) {
			return;
		}

		//search until reach the end node
		if (!Config.Path.showStep) {
			//run to the end
			while (!this.pathFound()) {
				this.fMinNode = this.getOpenNodeWithMinF();
				if (!this.fMinNode) {
					//no more nodes in the open list
					break;
				}
				this.neighboursIntoOpenArea(this.fMinNode);
			};

			//already reach the exit
			this.pathComplete();
		} else {
			//run step by step
			function runStep() {
				if (Config.Path.showStep) { //path step may be turned off any time during the timer
					if (!that.pathFound()) {
						that.fMinNode = that.getOpenNodeWithMinF();
						if (that.fMinNode) {
							that.neighboursIntoOpenArea(that.fMinNode);
							that.updateUI();
							setTimeout(runStep, Config.Path.stepDelay);
						}
					} else {
						//already reach the exit
						that.pathComplete();
					}
				}
			}
			runStep();
		}
	},

	getNode : function (row, col) {
		return this.cache['row_' + row + '_col_' + col];
	},

	getF : function (prvNode, crtNode) {
		var targetDistanceX = (this.exitNode.col - crtNode.col) * 10;
		var targetDistanceY = (this.exitNode.row - crtNode.row) * 10;
		var h = Math.round(Math.sqrt(Math.pow(targetDistanceX, 2) + Math.pow(targetDistanceY, 2)));

		var g = (prvNode.col == crtNode.col || prvNode.row == crtNode.row) ? 10 : 14;

		if (prvNode.fObj)
			g = prvNode.fObj.G + g;
		return {
			F : h + g,
			H : h,
			G : g
		};
	},

	inOpenArea : function (node) { //check if the node exists in the open area
		var openArea = this.openArea;
		for (var i = 0, l = openArea.length; i < l; i++) {
			if (openArea[i].id === node.id)
				return openArea[i];
		};

		return null;
	},

	neighboursIntoOpenArea : function (node) {
		for (var i = 0; i < node.neighbors.length; i++) {
			var position = node.neighbors[i];
			var neighborNode = this.getNode(position.row, position.col);
			if (!this.closeArea[neighborNode.id]) {
				var fObj = this.getF(node, neighborNode);
				// to the around node, if it exists in open area, get the new G value for it; if the new G is smaller, change its parent to current node
				tmpNode = this.inOpenArea(neighborNode);
				if (tmpNode) {
					if (tmpNode.fObj.G <= fObj.G)
						continue;
				};
				neighborNode.fObj = fObj;
				neighborNode.prev = node;
				this.openArea.push(neighborNode);
			}
		}
	},

	getOpenNodeWithMinF : function () { //get the node with smallest F from the open list; and move it to the close list
		if (this.openArea.length == 0) {
			return null;
		}
		this.sortOpenArea();
		this.closeArea[this.openArea[0].id] = this.openArea[0];
		return this.openArea.shift();
	},

	sortOpenArea : function () {
		this.openArea.sort(function (objF, objN) {
			return objF.fObj.F - objN.fObj.F;
		});
	},

	/* Begin: public methods */
	redraw : function (context, cellSize) {
		if (this.entranceNode == null || this.exitNode == null || this.stepNode == null) {
			return;
		}

		function drawArrow(context, cell, cellSize, withPadding) {
			var padding = withPadding ? cellSize * 0.1 : 0;
			context.moveTo(cell.col * cellSize + padding, cell.row * cellSize + padding);
			context.lineTo(cell.col * cellSize + cellSize - padding, cell.row * cellSize + cellSize / 2);
			context.lineTo(cell.col * cellSize + padding, cell.row * cellSize + cellSize - padding);
		}

		function drawRectangle(context, cell, cellSize, withPadding) {
			var padding = withPadding ? cellSize * 0.1 : 0;
			context.rect(cell.col * cellSize + padding, cell.row * cellSize + padding, cellSize - 2 * padding, cellSize - 2 * padding);
		}

		function drawEllipse(context, cell, cellSize, withPadding) {
			var padding = withPadding ? cellSize * 0.1 : 0;
			context.arc(cell.col * cellSize + cellSize / 2, cell.row * cellSize + cellSize / 2, cellSize / 2 - padding, 0, Math.PI * 2, false);
		}

		context.save();

		if (Config.Path.showStep) {
			//close area
			context.beginPath();
			for (key in this.closeArea) {
				drawRectangle(context, this.closeArea[key], cellSize, false);
			}
			context.fillStyle = Config.Path.closeAreaColor;
			context.fill();

			//open area
			context.beginPath();
			for (var i = 0; i < this.openArea.length; i++) {
				drawRectangle(context, this.openArea[i], cellSize, false);
			}
			context.fillStyle = Config.Path.openAreaColor;
			context.fill();
		}

		//path
		if (this.path.length > 0) {
			context.beginPath();
			for (var i = 0; i < this.path.length; i++) {
				var row = this.path[i].row;
				var col = this.path[i].col;
				var x = col * cellSize + cellSize / 2;
				var y = row * cellSize + cellSize / 2;

				if (i == 0) {
					context.moveTo(x, y);
				} else {
					context.lineTo(x, y);
				}
			}
			context.strokeStyle = Config.Path.pathColor;
			context.lineWidth = cellSize / 4;
			context.lineJoin = "round";
			context.stroke();
		}

		//F Min Node
		if (Config.Path.showStep && this.fMinNode != null) {
			context.fillStyle = Config.Path.fMinColor;
			context.beginPath();
			drawEllipse(context, this.fMinNode, cellSize, true);
			context.fill();
		}

		//entrance and exit
		context.fillStyle = Config.Path.entranceColor;
		context.beginPath();
		drawRectangle(context, this.entranceNode, cellSize, true);
		context.fill();

		context.fillStyle = Config.Path.exitColor;
		context.beginPath();
		drawArrow(context, this.exitNode, cellSize, true);
		context.fill();

		//current node
		context.fillStyle = Config.Path.stepColor;
		context.beginPath();
		drawEllipse(context, this.stepNode, cellSize, true);
		context.fill();
		
		if(this.stepNode.row == this.exitNode.row && this.stepNode.col == this.exitNode.col) {
			context.fillStyle = "#FF3300";
			context.font = "50px verdana";
			context.fillTextEx("Congratulations!", this.maze.rows * cellSize / 2 , this.maze.cols * cellSize / 2, "center", "middle");
		}

		context.restore();
	},

	pathFound : function () {
		return this.exitNode != null && this.closeArea[this.exitNode.id];
	},

	getPathLength : function () {
		return this.path.length - 1;
	},

	randomEntranceAndExit : function () {
		if (this.maze == null) {
			return;
		}

		//set a random entrance and exit
		this.setEntranceAndExit(rand(0, this.maze.rows - 1), 0, rand(0, this.maze.rows - 1), this.maze.cols - 1);

		//update the UI
		this.updateUI();
	},

	setEntranceAndExit : function (row1, col1, row2, col2) {
		this.entranceNode = this.getNode(row1, col1);
		this.exitNode = this.getNode(row2, col2);
		this.stepNode = this.getNode(row1, col1);
		this.fMinNode = null;
		this.openArea = [];
		this.closeArea = {};
		this.path = [];
		this.stepCounter = 0;
		this.updateUI();
	},

	moveStep : function (row, col) {
		if (this.stepNode == null) {
			return false;
		}
		var nextRow = this.stepNode.row + row;
		var nextCol = this.stepNode.col + col;
		var nextNode = this.getNode(nextRow, nextCol);
		if (nextNode != null && this.stepNode.canGoTo(nextNode)) {
			this.stepNode = nextNode;
			this.stepCounter++;
			this.updateUI();
			return true;
		} else {
			return false;
		}
	} //end of moveStep
}

function AStarNode(row, col) {
	this.row = row;
	this.col = col;
	this.id = 'row_' + row + '_col_' + col;
	this.prev = null;
	this.fObj = null;
	//the neighbour nodes which can be accessed, item example {row: 10, col: 12}
	this.neighbors = [];
}

AStarNode.prototype = {
	canGoTo : function (node) {
		//check if the specified node is in the neighbours list
		for (var i = 0; i < this.neighbors.length; i++) {
			if (this.neighbors[i].row == node.row && this.neighbors[i].col == node.col) {
				return true;
			}
		}
		return false;
	}
}
