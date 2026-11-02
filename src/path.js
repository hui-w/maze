/**
 * @author Wang, Hui (huiwang@qlike.com)
 * @repo https://github.com/hui-w/maze
 * @licence MIT
 */
class Path {
  constructor() {
    this.maze = null;

    this.entranceNode = null;
    this.exitNode = null;
    this.stepNode = null;
    this.manuallySolved = false;
    this.aStarPath = [];
    this.manualPath = [];
    this.astar = null;

    this.onUpdateUI = null;
    this.onPathComplete = null;
  }

  updateUI() {
    if (typeof this.onUpdateUI == "function") {
      this.onUpdateUI();
    }
  }

  pathComplete() {
    if (this.astar != null && this.astar.isFound()) {
      //park the marker on the exit, under the exit square
      this.stepNode = this.exitNode;
      //AStar returns the route from entrance to exit
      this.aStarPath = this.astar.getRoute() || [];
    }

    //refresh the UI
    this.updateUI();

    if (typeof this.onPathComplete == "function") {
      this.onPathComplete();
    }
  }

  /* initialize without maze object  will only cleat the contents and refresh the UI*/
  init(maze) {
    this.maze = maze;
    this.entranceNode = null;
    this.exitNode = null;
    this.stepNode = null;
    this.manuallySolved = false;
    this.aStarPath = [];
    this.manualPath = [];
    this.astar = null;

    if (maze != null) {
      //get a randomized entrance and exit
      this.randomEntranceAndExit();
    } else {
      //update the UI when resetting
      this.updateUI();
    }
  }

  getPath() {
    this.manuallySolved = false;
    const that = this;
    if (this.entranceNode == null || this.exitNode == null) {
      return;
    }

    this.aStarPath = [];

    //the maze-specific part of the search lives here, in the adapter:
    //how to reach neighbours, what a step costs, and how far a cell
    //looks from the exit. AStar itself knows none of this.
    this.astar = new AStar(
      this.entranceNode,
      this.exitNode,
      (node) => {
        //neighbours are the cells on the other side of an open wall
        const neighbors = [];
        for (let i = 0; i < node.walls.length; i++) {
          let wall = node.walls[i];
          if (wall.isOpen) {
            neighbors.push(wall.getOtherCell(node));
          }
        }
        return neighbors;
      },
      {
        getCost: () => 10,
        getHeuristic: (node, goal) => {
          return Math.round(
            Math.sqrt(
              Math.pow((goal.col - node.col) * 10, 2) +
                Math.pow((goal.row - node.row) * 10, 2),
            ),
          );
        },
        getKey: (node) => {
          return "row_" + node.row + "_col_" + node.col;
        },
      },
    );
    this.astar.init();

    //search until reach the end node
    if (Config.Path.stepDelay == 0) {
      //run to the end
      while (!this.astar.isFound()) {
        this.stepNode = this.astar.step();
        if (!this.stepNode) {
          //no more nodes in the open list
          break;
        }
      }

      //already reach the exit
      this.pathComplete();
    } else {
      //run step by step
      const runStep = () => {
        if (Config.Path.stepDelay > 0) {
          //path step may be turned off any time during the timer
          if (!that.astar.isFound()) {
            that.stepNode = that.astar.step();
            if (that.stepNode) {
              that.updateUI();
              setTimeout(runStep, Config.Path.stepDelay);
            }
          } else {
            //already reach the exit
            that.pathComplete();
          }
        }
      };
      runStep();
    }
  }

  getNode(row, col) {
    //cells are stored row by row, so the index is row * cols + col
    if (
      this.maze == null ||
      row < 0 ||
      col < 0 ||
      row >= this.maze.rows ||
      col >= this.maze.cols
    ) {
      return null;
    }
    return this.maze.cells[row * this.maze.cols + col];
  }

  /* Begin: public methods */
  redraw(context, cellSize) {
    if (
      this.entranceNode == null ||
      this.exitNode == null ||
      this.stepNode == null
    ) {
      return;
    }

    const drawArrow = (context, cell, cellSize, withPadding) => {
      const padding = withPadding ? cellSize * 0.1 : 0;
      context.moveTo(
        cell.col * cellSize + padding,
        cell.row * cellSize + padding,
      );
      context.lineTo(
        cell.col * cellSize + cellSize - padding,
        cell.row * cellSize + cellSize / 2,
      );
      context.lineTo(
        cell.col * cellSize + padding,
        cell.row * cellSize + cellSize - padding,
      );
    };

    const drawRectangle = (context, cell, cellSize, withPadding) => {
      const padding = withPadding ? cellSize * 0.1 : 0;
      context.rect(
        cell.col * cellSize + padding,
        cell.row * cellSize + padding,
        cellSize - 2 * padding,
        cellSize - 2 * padding,
      );
    };

    const drawEllipse = (context, cell, cellSize, withPadding) => {
      const padding = withPadding ? cellSize * 0.1 : 0;
      context.arc(
        cell.col * cellSize + cellSize / 2,
        cell.row * cellSize + cellSize / 2,
        cellSize / 2 - padding,
        0,
        Math.PI * 2,
        false,
      );
    };

    context.save();

    if (Config.Path.stepDelay > 0 && this.astar != null) {
      //close area
      context.beginPath();
      for (let i = 0; i < this.astar.closeArea.length; i++) {
        drawRectangle(context, this.astar.closeArea[i], cellSize, false);
      }
      context.fillStyle = Config.Path.closeAreaColor;
      context.fill();

      //open area
      context.beginPath();
      for (let i = 0; i < this.astar.openArea.length; i++) {
        drawRectangle(context, this.astar.openArea[i], cellSize, false);
      }
      context.fillStyle = Config.Path.openAreaColor;
      context.fill();
    }

    //line: auto mode draws the A* route (aStarPath); manual mode, once the exit is
    //reached, draws every cell actually walked, in the order visited,
    //using the same line style as the auto mode
    const line = this.manuallySolved ? this.manualPath : this.aStarPath;
    if (line.length > 0) {
      context.beginPath();
      for (let i = 0; i < line.length; i++) {
        let row = line[i].row;
        let col = line[i].col;
        let x = col * cellSize + cellSize / 2;
        let y = row * cellSize + cellSize / 2;

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

    const markerAtExit = this.isAtExit();
    if (!markerAtExit) {
      //the player and A* search share one marker because they run in separate modes
      context.fillStyle = Config.Path.stepColor;
      context.beginPath();
      drawEllipse(context, this.stepNode, cellSize, true);
      context.fill();
    }

    //entrance and exit
    context.fillStyle = Config.Path.entranceColor;
    context.beginPath();
    drawArrow(context, this.entranceNode, cellSize, true);
    context.fill();

    context.fillStyle = Config.Path.exitColor;
    context.beginPath();
    drawRectangle(context, this.exitNode, cellSize, true);
    context.fill();

    if (markerAtExit) {
      context.fillStyle = Config.Path.stepColor;
      context.beginPath();
      drawEllipse(context, this.stepNode, cellSize, true);
      context.fill();
    }

    if (this.manuallySolved) {
      context.fillStyle = "#0B4F33";
      context.font = "50px verdana";
      context.fillTextEx(
        "Maze Solved",
        (this.maze.cols * cellSize) / 2,
        (this.maze.rows * cellSize) / 2,
        "center",
        "middle",
      );
    }

    context.restore();
  }

  isAtExit() {
    return (
      this.stepNode != null &&
      this.exitNode != null &&
      this.stepNode.row == this.exitNode.row &&
      this.stepNode.col == this.exitNode.col
    );
  }

  pathFound() {
    return this.astar != null && this.astar.isFound();
  }

  getPathLength() {
    return this.aStarPath.length - 1;
  }

  //manual steps are the cells walked, minus the starting entrance cell;
  //an empty trail (no entrance yet) has no step count at all, so this
  //returns null, not 0: 0 now unambiguously means an entrance exists
  //and no step has been taken yet. Game.updateCounters shows N/A for null
  getStepCount() {
    return this.manualPath.length > 0 ? this.manualPath.length - 1 : null;
  }

  randomEntranceAndExit() {
    if (this.maze == null) {
      return;
    }

    //set a random entrance and exit
    this.setEntranceAndExit(
      rand(0, this.maze.rows - 1),
      0,
      rand(0, this.maze.rows - 1),
      this.maze.cols - 1,
    );

    //update the UI
    this.updateUI();
  }

  setEntranceAndExit(row1, col1, row2, col2) {
    this.entranceNode = this.getNode(row1, col1);
    this.exitNode = this.getNode(row2, col2);
    this.stepNode = this.getNode(row1, col1);
    this.manuallySolved = false;
    this.aStarPath = [];
    this.astar = null;
    //the manual trail starts at the entrance, before the first step
    this.manualPath = [
      { row: this.entranceNode.row, col: this.entranceNode.col },
    ];
    this.updateUI();
  }

  moveStep(row, col) {
    if (this.stepNode == null) {
      return false;
    }
    const nextRow = this.stepNode.row + row;
    const nextCol = this.stepNode.col + col;
    const nextNode = this.getNode(nextRow, nextCol);
    if (nextNode != null && this.stepNode.canGoTo(nextNode)) {
      if (this.manualPath.length == 0) {
        //trail was not seeded (stepNode set without setEntranceAndExit)
        this.manualPath.push({
          row: this.stepNode.row,
          col: this.stepNode.col,
        });
      }
      this.stepNode = nextNode;
      this.manualPath.push({ row: nextNode.row, col: nextNode.col });
      this.manuallySolved = this.isAtExit();
      this.updateUI();
      return true;
    } else {
      return false;
    }
  } //end of moveStep
}
