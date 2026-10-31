/** 
* @author Wang, Hui (huiwang@qlike.com) 
* @repo https://github.com/hui-w/maze
* @licence MIT 
*/ 
var CanvasSize = {
	//fixed width and height of canvas
	Fixed : 0,

	//width and height are calculated by grid size and the maze size
	Dynamic : 1,

	//full screen with window width and height
	Fullscreen : 2
}

var Config = {
	General : {},
	Game : {
		padding : 4,
		backgroundColor : "#FFFDF7",
		keyboardTimerDelay : 200,
		canvasSize : CanvasSize.Fixed,
		gridSize : 10, //only used when canvasSize == Dynamic
		width : 500, //only used when canvasSize == fixed
		height : 500 //only used when canvasSize == fixed
	},
	Maze : {
		rows : 16,
		cols : 16,
		wallColor : "#0B4F33",
		highlightedWallColor : "#D94530",
		highlightedCellColor : "RGBA(255,182,8,0.35)",
		showStep : false,
		stepDelay : 20
	},
	Path : {
		pathColor : "RGBA(0,156,88,0.9)",
		entranceColor : "#D94530",
		exitColor : "#009C58",
		stepColor : "#FFB608",
		fMinColor : "#D94530",
		openAreaColor : "RGBA(255,182,8,0.4)",
		closeAreaColor : "RGBA(0,156,88,0.15)",
		showStep : false,
		stepDelay : 40
	}
}
