//dependencies for each module used
var express = require('express');
var http = require('http');
var path = require('path');
var handlebars = require('express3-handlebars');
var app = express();
//load environment variables
var dotenv = require('dotenv');
dotenv.load();

//fbgraph
var graph = require('fbgraph');

//twit
// var twit = require('twit');

//twitter oauth
var passport = require('passport');
var util = require('util');
// var passportTwitterStrategy = require('passport-twitter').Strategy;

//have two blank strings for access token and access secret
var accessToken = "";
var accessSecret = "";
// var twitterOauth = {
// 	consumer_key: process.env.twitter_client_id,
// 	consumer_secret: process.env.twitter_client_secret,
// 	access_token: accessToken,
// 	access_token_secret: accessSecret
// };

//Set up passport session set up.
//This allows persistant login sessions so the user doesn't need to keep logging in everytime
//for their access token
passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

// Simple route middleware to ensure user is authenticated.
function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { return next(); }
	res.redirect('/');
}


//Use TwitterStrategy with passport
// passport.use(new passportTwitterStrategy({
// 	consumerKey: process.env.twitter_client_id,
// 	consumerSecret: process.env.twitter_client_secret,
// 	callbackURL: "http://localhost:3000/auth/twitter/callback"
// }, function (token, tokenSecret, profile, done) {
// 	//setting up access token
// 	accessToken = token;
// 	accessSecret = tokenSecret;
// 	twitterOauth.access_token = token;
// 	twitterOauth.access_token_secret = tokenSecret;
// 	//Continuing on
// 	process.nextTick(function() {
// 		return done(null, profile);
// 	});
// }));

//Configures the Template engine
app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.bodyParser());
//more setting up configuration for express
//Allows cookie access and interaction
app.use(express.cookieParser() );
app.use(express.session({ secret: 'nyan cat'}));
//Intialize passport
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

//routes
app.get('/', function(req,res) { 
	res.render("index");
});

app.get('/getBandJSON', function(req, res) {
	var name2Index = {},
		index2name = {},
		bandLikes = {}, 
		corr = [];
	graph.get("/me/friends", function(err, facebookRes) {
		if(typeof facebookRes.data === "undefined" || err) {
			res.redirect('/login');
			return;
		}
		var friends = facebookRes.data;
		var i, j, chunkOfIds, chunkSize = 10;
		var numChunks = friends.length/chunkSize;
		var chunkNo = 0, bandCount = 0;
		for(i=0; i<friends.length; i+= chunkSize) {
			var ids = [], idstr = '';
			for(j=i; j<friends.length && j<i+chunkSize; ++j) {
				ids.push(friends[j].id);
			}
			idstr = ids.join(",");
		/*
		var q = {
				"friendsLikes":"SELECT uid, page_id FROM page_fan WHERE type='MUSICIAN/BAND' and uid IN (SELECT uid2 FROM friend WHERE uid1 = me() LIMIT 200)",
				"pages":"SELECT page_id, name, type FROM page WHERE page_id IN (SELECT page_id FROM #friendsLikes)"
				};
		*/
			graph.fql("select music, uid from user where uid in ("+idstr+")", function(fberr, fbRes) {
				if(typeof facebookRes.data === "undefined" || err) {
					res.json({error: err, msg: "Could not get your friend's posted links."});
					return;
				}
				var chunk = ++chunkNo;
				for (var k = fbRes.data.length - 1; k >= 0; k--) {
					var bands = fbRes.data[k].music;
					if(!bands)
						continue;
					var indices = [];
					bands = bands.split(', ');
					for (var l = bands.length - 1; l >= 0; l--) {
						if(typeof name2Index[bands[l]] === "undefined") {
							index2name[bandCount] = bands[l];
							name2Index[bands[l]] = bandCount++;
						}
						indices.push(name2Index[bands[l]]);
					};
					corr.push(indices);
				};
				if(chunk > numChunks) {
					
					for (var k = corr.length - 1; k >= 0; k--) {
						for (var l = corr[k].length - 1; l >= 0; l--) {
							for (var m = corr[k].length - 1; m >= 0; m--) {
								if(typeof bandLikes[corr[k][l]] === "undefined")
									bandLikes[corr[k][l]] = {};
								if(typeof bandLikes[corr[k][l]][corr[k][m]] === "undefined")
									bandLikes[corr[k][l]][corr[k][m]] = 1;
								else
									bandLikes[corr[k][l]][corr[k][m]]++;
							};
						};
					};
					var newCount = 0;
					t = process.hrtime();
					var okList = {};
					for (var k = 0; k < bandCount; k++) {
						var threshold = 5;
						if(bandLikes[k][k] >= threshold) {
							okList[k] = {};
							newCount++;
						}
					}
					var nodes = [], 
						edges = [];
					var sourceKeys = Object.keys(okList);	//sourceKeys[i] is the key of a band to create
					for (var k = 0; k < sourceKeys.length; k++) {
						nodes.push({"name": index2name[sourceKeys[k]], "size": 45, "imports": []});
					}
					for (var k = 0; k < sourceKeys.length; k++) {
						var currSrc = sourceKeys[k];
						var targetKeys = Object.keys(bandLikes[currSrc]);
						for (var l = k+1; l < targetKeys.length; l++) {
							var currTgt = targetKeys[l];
							if(!(currTgt in okList) || !bandLikes[currTgt])
								continue;
							if(bandLikes[currSrc][currSrc] > bandLikes[currTgt][currTgt]) {
								nodes[k].imports.push(index2name[currTgt]);
							}
							else {
								nodes[sourceKeys.indexOf(currTgt)].imports.push(index2name[currSrc]);
							}
						}
					}
					t = process.hrtime(t);
					console.log("took %d s and %d ns", t[0], t[1]);
					res.json(nodes);
					//es.json({"bandCount": newCount, "nodes": nodes, "edges": edges});
				}
			});
		}
	});
});

app.get('/discover', function(req,res) { 
	res.render("discover");
});

//fbgraph authentication
app.get('/auth/facebook', function(req, res) {
	if (!req.query.code) {
		var authUrl = graph.getOauthUrl({
			'client_id': process.env.facebook_client_id,
			'redirect_uri': 'http://localhost:3000/auth/facebook',
			'scope': 'user_about_me, user_likes, friends_likes'//you want to update scope to what you want in your app
		});

		if (!req.query.error) {
			res.redirect(authUrl);
		} else {
			res.send('access denied');
		}
		return;
	}
	graph.authorize({
		'client_id': process.env.facebook_client_id,
		'redirect_uri': 'http://localhost:3000/auth/facebook',
		'client_secret': process.env.facebook_client_secret,
		'code': req.query.code
	}, function( err, facebookRes) {
		res.redirect('/discover');
	});
});

app.get('/UserHasLoggedIn', function(req, res) {
	graph.get('me', function(err, response) {
		console.log(err); //if there is an error this will return a value
		data = { facebookData: response};
		res.render('facebook', data);
	});
});


//twitter authentication Oauth setup
//this will set up twitter oauth for any user not just one
// app.get('/auth/twitter', passport.authenticate('twitter'), function(req, res) {
// 	//nothing here because callback redirects to /auth/twitter/callback
// });

//callback. authenticates again and then goes to twitter
// app.get('/auth/twitter/callback', 
// 	passport.authenticate('twitter', { failureRedirect: '/' }),
// 	function(req, res) {
// 		res.redirect('/twitter');
// 	});


// app.get('/twitter', ensureAuthenticated, function(req, res) {
// 	//I can use twitterOauth as previously it's an array set up with the correcet information
// 	var T = new twit(twitterOauth); 
// 	T.get('/friends/list', function (err, reply) {
// 		console.log(err); //If there is an error this will return a value
// 		data = { twitterData: reply };
// 		res.render('twitter', data);
// 	});
// });

//set environment ports and start application
app.set('port', process.env.PORT || 3000);
http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});