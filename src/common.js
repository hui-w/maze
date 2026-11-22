/** 
* @author Wang, Hui (huiwang@qlike.com) 
* @repo https://github.com/hui-w/maze
* @licence MIT 
*/ 
/* get the rand number between lower and upper */
function rand(lower, upper) {
	return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function loadGameSetting(game, key, allowed, fallback) {
	try {
		const value = localStorage.getItem(game + "." + key);
		if (value && Object.prototype.hasOwnProperty.call(allowed, value)) {
			return value;
		}
	} catch (error) {
		console.warn("Unable to load game setting:", error);
	}
	return fallback;
}

function saveGameSetting(game, key, value) {
	try {
		localStorage.setItem(game + "." + key, value);
	} catch (error) {
		console.warn("Unable to save game setting:", error);
	}
}

function createChild(parent, tag, param, innerHTML) {
	const element = document.createElement(tag);
	parent.appendChild(element);
	if (param) {
		for (let key in param) {
			element.setAttribute(key, param[key]);
		}
	}
	if (innerHTML) {
		element.innerHTML = innerHTML;
	}

	return element;
}

function antiFuzzyLine(context, x1, y1, x2, y2) {
	if (context.lineWidth % 2 == 1) {
		//snap to whole pixels (cell size may be fractional) and shift by 0.5 to avoid fuzzy line
		x1 = Math.round(x1) - 0.5;
		y1 = Math.round(y1) - 0.5;
		x2 = Math.round(x2) - 0.5;
		y2 = Math.round(y2) - 0.5;
	}
	context.moveTo(x1, y1);
	context.lineTo(x2, y2);
}

function drawGameMessage(context, text, width, height) {
	context.save();
	context.fillStyle = "#0B4F33";
	context.font = "50px verdana";
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText(text, width / 2, height / 2);
	context.restore();
}
