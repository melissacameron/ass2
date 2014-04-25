var auth = require('../auth');
var url = require('url');

exports.view = function(req, res) {
	res.render('index');
}

exports.login = function(req, res) {
	if (!req.query.code) {
	    if (!req.query.error) { //checks whether a user denied the app facebook login/permissions
	    	res.redirect(auth.fbAuthUrl);
	    } else {  //req.query.error == 'access_denied'
	    	res.send('access denied');
	    }
	    return;
  	}

  	auth.graph.authorize(
  	  auth.fbAuthObj(req)
  	, function(err, facebookRes) {
  		res.redirect('/loggedin');
  	});
}

exports.loggedin = function(req, res) {
	var me, timeline;
	auth.graph.get("/me", {access_token: auth.graph.getAccessToken()}, function(err, facebookRes) {
		me = facebookRes;
		res.render("index", {loggedIn:1, me: me});	
	});
}

exports.getBandJSON = function(req, res) {
	var name2Index = {},
		index2name = {},
		bandLikes = {}, 
		corr = [];
	auth.graph.get("/me/friends", function(err, facebookRes) {
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
			auth.graph.fql("select music, uid from user where uid in ("+idstr+")", function(fberr, fbRes) {
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
					res.json({"bandCount": newCount, "nodes": nodes, "edges": edges});
				}
			});
		}
	});
}