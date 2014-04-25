$(document).ready(function() {
	initializePage();
});

function initializePage() {
	loadSpinner();
    var $canvas = $('#canvas');
    var $canvasContainer = $('#canvas-container');
	// Set the width and height
	var width = $('#canvas-container').width();
	var height = Math.floor(width * 0.65);
	var pixelWidth = width;
	var pixelHeight = height;

	$canvas.css({'width': width + 'px', 'height': height + 'px'});

	$canvas.attr('width', pixelWidth);
	$canvas.attr('height', pixelHeight);
	if(document.location.pathname == "/")
		return;
	$('.twitterDivClassName').hide()
	$.get("/getBandJSON", function(data) {
		$('.twitterDivClassName').show()
		if(data.err) {
			console.log("uh oh");
			return;
		}
		console.log(data);
return;
		var list = data.data;
		list.sort(function(a, b) {
			if(a[1] < b[1])
				return 1;
			if(a[1] > b[1])
				return -1;
			else
				return 0;
		});
		$("#loadingMsg").html("<h3>Looks like your friends have restless feet;<br>Below is a map of your Facebook friend's digital world.<br><em>"+list[0][0]+"</em> was shared the most.</h3>");
		WordCloud(document.getElementById("canvas"), {
			list: list,	
	  		gridSize: Math.round(16 * $('#canvas').width() / 1024),
			weightFactor: function (size) {
				return Math.pow(size, 2) * $('#canvas').width() / 1024;
			},
			fontFamily: 'Times, serif',
			color: 'random-light',
			shuffle: true,
			rotateRatio: 0,
			backgroundColor: '#141414'
		});
	});
}

function loadSpinner() {
	var spinnerOpts = {
		lines: 13, // The number of lines to draw
		length: 7, // The length of each line
		width: 2, // The line thickness
		radius: 10, // The radius of the inner circle
		corners: 1, // Corner roundness (0..1)
		rotate: 0, // The rotation offset
		direction: 1, // 1: clockwise, -1: counterclockwise
		color: '#000', // #rgb or #rrggbb or array of colors
		speed: 1, // Rounds per second
		trail: 60, // Afterglow percentage
		shadow: false, // Whether to render a shadow
		hwaccel: false, // Whether to use hardware acceleration
		className: 'spinner', // The CSS class to assign to the spinner
		zIndex: 2e9, // The z-index (defaults to 2000000000)
		top: 33, // Top position relative to parent in px
		left: 'auto' // Left position relative to parent in px
	};
	var target = document.getElementById('spinDiv');
	var spinner = new Spinner(spinnerOpts).spin(target);
	$('.spinner').css("top", 100);
}

