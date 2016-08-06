/** 
* @author Wang, Hui (huiwang@qlike.com) 
* @repo https://github.com/hui-w/maze
* @licence MIT 
*/ 
function $() {
	var elements = new Array();
	for (var i = 0; i < arguments.length; i++) {
		var element = arguments[i];
		if (typeof element == 'string')
			element = document.getElementById(element);
		if (arguments.length == 1)
			return element;
		elements.push(element);
	}
	return elements;
}

/* get the rand number between lower and upper */
function rand(lower, upper) {
	return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

Array.prototype.removeAt = function (indexNum) {
	if (isNaN(indexNum) || indexNum > this.length) {
		return false;
	}
	this.splice(indexNum, 1);
};

Element.prototype.createChild = function (tag, param, innerHTML) {
	var element = document.createElement(tag);
	this.appendChild(element);
	if (param) {
		for (key in param) {
			element.setAttribute(key, param[key]);
		}
	}
	if (innerHTML) {
		element.innerHTML = innerHTML;
	}

	return element;
};

Element.prototype.hasClassName = function (a) {
	return new RegExp("(?:^|\\s+)" + a + "(?:\\s+|$)").test(this.className);
}

Element.prototype.addClassName = function (a) {
	if (!this.hasClassName(a)) {
		this.className = [this.className, a].join(" ");
	}
}

Element.prototype.removeClassName = function (b) {
	if (this.hasClassName(b)) {
		var a = this.className;
		this.className = a.replace(new RegExp("(?:^|\\s+)" + b + "(?:\\s+|$)", "g"), " ");
	}
}

var canvasPrototype = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
canvasPrototype.antiFuzzyLine = function (x1, y1, x2, y2) {
	if (this.lineWidth % 2 == 1) {
		if (this.lineWidth > 1)
			console.log(this.lineWidth);
		//+0.5 to avoid fuzzy line
		x1 -= 0.5;
		y1 -= 0.5;
		x2 -= 0.5;
		y2 -= 0.5;
	}
	this.moveTo(x1, y1);
	this.lineTo(x2, y2);
};

/*
horizontalAlign: left, center, right
verticalAlign: top, middle, bottom
 */
canvasPrototype.fillTextEx = function (text, x, y, horizontalAlign, verticalAlign) {
	this.save();
	var textLeft = x;
	if (horizontalAlign != "left") {
		var textWidth = this.measureText(text).width;
		if (horizontalAlign == "center") {
			textLeft -= textWidth / 2;
		} else if (horizontalAlign == "right") {
			textLeft -= textWidth;
		}
	}
	this.textBaseline = verticalAlign;
	this.fillText(text, textLeft, y);
	this.restore();
}
