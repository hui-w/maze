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
		backgroundColor : "#DEEDF7",
		keyboardTimerDelay : 200,
		canvasSize : CanvasSize.Fixed,
		gridSize : 10, //only used when canvasSize == Dynamic
		width : 500, //only used when canvasSize == fixed
		height : 500 //only used when canvasSize == fixed
	},
	Maze : {
		rows : 32,
		cols : 32,
		wallColor : "RGB(0, 0, 0)",
		highlightedWallColor : "#ff0000",
		highlightedCellColor : "RGBA(171,174,180,0.5)",
		showStep : false,
		stepDelay : 20
	},
	Path : {
		pathColor : "RGBA(219, 69, 32, 1)",
		entranceColor : "#436EB3",
		exitColor : "#03A957",
		stepColor : "#436EB3",
		fMinColor : "#ff3300",
		openAreaColor : "RGBA(255,0,0,0.3)",
		closeAreaColor : "RGBA(171,174,180,0.5)",
		showStep : false,
		stepDelay : 40
	}
}
