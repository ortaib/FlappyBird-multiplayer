var express = require("express");
var app = express();
var serv = require("http").Server(app);
var io = require("socket.io")(serv,{});
var game = {
	numOfPlayers : 0,
	playersDead : 0,
	rdyPlayers : 0,
	splashPlayers : 0,
	maxPlayers : 3,
	SOCKET_LIST : [],
	PLAYER_LIST : [],
	playersInit : [{taken:false,color:"red"},{taken:false,color:"blue"},{taken:false,color:"yellow"}],
	cvsHeight : 512,
	cvsWidth : 320,
	pipeNorthheight : 242,
	pipeNorthwidth : 52,
	fgheight : 118,
	frames : 0,
	fgpos : 0,
	states : {Splash : 0 , Game: 1, Score: 2, Wait: 3},
	currentState : 0
}
//Player Object
var countdown = {
	countTo : 180,
	sec : 0,
	digit : 3,
	isOn : false,
	tick : function(){
		this.sec--;
		this.digit = Math.floor(this.sec/60)%4+1;
		if(this.sec<0){
			this.isOn=false;
			game.currentState=game.states.Game;
			console.log("currentState changed to Game");
			for(var i in game.PLAYER_LIST){
					game.PLAYER_LIST[i].state = game.states.Game;
					game.PLAYER_LIST[i].score = 0;
					game.PLAYER_LIST[i].jump();
			}
		}
	},
	start : function(){
		this.isOn = true;
		this.digit = 3;
		this.sec = this.countTo;
	}
};
var Player = function(id){
	var bird = {
	id : id,
	color : "red",
	state : game.states.Splash,
	x : 20,
	y : 0,
	score : 0,
	best : 0,
	medal : 0,
	frame : 0,
	radius : 12,
	velocity : 0,
	animation : [0,1,2,1],
	rotation : 0,
	_jump : 4,
	gravity : 0.25,

	jump : function(){
		this.velocity = - this._jump;
	},
	update : function(){
		var n = ((this.state === game.states.Splash)||(this.state===game.states.Wait)) ? 10 : 5;
		this.frame += game.frames % n ===0 ? 1 : 0;
		this.frame %= this.animation.length;
		if((this.state === game.states.Splash)||(this.state === game.states.Wait)) {
			this.y = (game.cvsHeight -280 + 5*Math.cos(game.frames/10));
			this.rotation = 0;
		}
		else{
			this.velocity += this.gravity;
			this.y+= this.velocity;
			if (this.y >= (game.cvsHeight-game.fgheight-10)){
				this.y = game.cvsHeight-game.fgheight-10;
				if(this.state === game.states.Game){
					this.state = game.states.Score;
					this.medal = game.playersDead;
					game.playersDead++;
				}
				this.velocity = this._jump;
			}
			if(this.velocity>= this._jump){
				this.frame=1;
				this.rotation = Math.min(Math.PI/2,this.rotation + 0.3);
			}
			else{
				this.rotation = - 0.3;
			}
			
		}
	}
	};
return bird;
}
//Pipes object
var pipes = {

	_pipes : [],
	update : function(){
		if(game.frames%110 === 0){
			var _y =  Math.floor(Math.random()*game.pipeNorthheight +10)-game.pipeNorthheight;
			this._pipes.push({
				x:game.cvsWidth,
				y:_y,
				width:game.pipeNorthwidth,
				height:game.pipeNorthheight
			});
		}

		for (var i = 0,len=this._pipes.length; i < len; i++) {
			var p = this._pipes[i];
			if(i==0){
				for (var j in game.PLAYER_LIST) {
					bird = game.PLAYER_LIST[j];
					if(bird.state === game.states.Game){
						bird.score += (bird.x === p.x)? 1 : 0;
						var cx = Math.min(Math.max(bird.x, p.x), p.x+p.width);
						var cy1 = Math.min(Math.max(bird.y, p.y), p.y+p.height);
						var cy2 = Math.min(Math.max(bird.y, p.y+p.height+80),p.y+p.height+80+p.height);
						var dx = bird.x - cx;
						var dy1 = bird.y - cy1;
						var dy2 = bird.y - cy2;

						var d1 = dx*dx+dy1*dy1;
						var d2 = dx*dx+dy2*dy2;
						var r = bird.radius*bird.radius;
						if(r>d1 || r>d2){
							bird.state = game.states.Score;
							bird.medal = game.playersDead;
							game.playersDead++;

						}
					}
				}
			}
			if(this._pipes.length>0){
				p.x -=2;
				if(p.x < -50){
					this._pipes.splice(i,1);
					i--;
					len--;
				}
			}
		}

	},
	reset : function(){
		this._pipes =[];
	}
}
//start session
app.get("/",function(req,res){
	if(game.numOfPlayers<game.maxPlayers){
		res.sendFile(__dirname + "/client/FlappyBirdMPclient.html");
		console.log("Someone connected");
		console.log(game.numOfPlayers);
	}
	else{
		console.log("Someone tried to connect but server was full : "+game.numOfPlayers);
		console.log(game.numOfPlayers);
	}
	});
//send client imgs
app.use("/client",express.static(__dirname + "/client"));
serv.listen(2000,function(){
	console.log("Start listening at port 2000");
});
//when connecting with socket
io.sockets.on("connection",function(socket){
	game.numOfPlayers++;
	if(game.SOCKET_LIST.length == 0){
		game.currentState = game.states.Wait;
		console.log("currentState changed to Wait");

	}
	socket.id = getId();
	var player = new Player(socket.id);
	player.color = game.playersInit[socket.id].color;
	player.x+= player.id*40;
	game.SOCKET_LIST[socket.id] = socket;
	game.PLAYER_LIST[socket.id] = player;
	game.splashPlayers++;
	console.log("Player #"+socket.id+" has connected");
	var players = [];
	for(var i in game.PLAYER_LIST){
		if(i != socket.id)
			players.push(game.PLAYER_LIST[i]);
	}
	socket.emit("loadGame",{yourbird : game.PLAYER_LIST[socket.id],
							players: players,
							frames: game.frames,
							fgpos:game.fgpos,
							currentState:game.currentState
				});
	socket.on("disconnect",function(){
		game.numOfPlayers--;
		if(socket.id> -1)
			game.playersInit[socket.id].taken=false;
		if(game.PLAYER_LIST[socket.id].state === game.states.Wait){
			game.rdyPlayers--;
		}
		if(game.PLAYER_LIST[socket.id].state === game.states.Splash)
			game.splashPlayers--;
		delete game.PLAYER_LIST[socket.id];
		delete game.SOCKET_LIST[socket.id];
		console.log("Player #" +socket.id+" has disconected");
	});
	socket.on("clicked",function(){
		if(game.PLAYER_LIST[socket.id].state === game.states.Game)
			game.PLAYER_LIST[socket.id].jump();
		else if (game.PLAYER_LIST[socket.id].state === game.states.Splash){
			game.PLAYER_LIST[socket.id].state = game.states.Wait;
			game.rdyPlayers++;
			game.splashPlayers--;
			if(game.rdyPlayers>=game.playersInit.length){
				countdown.start();
				game.frames=0;
				pipes.reset();
			}
		}
		else if(game.currentState===game.states.Score && game.PLAYER_LIST[socket.id].state ===game.states.Score){
			game.PLAYER_LIST[socket.id].state = game.states.Splash;
			game.splashPlayers++;
			if(game.splashPlayers >= game.playersInit.length){
				game.currentState = game.states.Splash;
				console.log("currentState changed to Splash");
			}
		}
	});
});

setInterval(update,1000/60);
function update(){
	if(game.currentState === game.states.Wait){
		updateWaitingRoom();
	}
	if(game.currentState === game.states.Splash){
		updateWaitingRoom();
	}
	if(game.currentState === game.states.Game){
		updateGameRoom();
	}
	if(game.currentState === game.states.Score){
		updateScoreRoom();
	}

}
function updateScoreRoom(){
	game.frames++;
	for(var i in game.PLAYER_LIST){
		game.PLAYER_LIST[i].update();
	}
	sendData();
	if(game.splashPlayers+game.rdyPlayers == game.numOfPlayers){
			game.currentState = game.states.Splash;
			console.log("currentState changed to Splash");
			game.splashPlayers=0;
		}
}
function updateGameRoom(){
	game.frames++;
	game.fgpos = (game.fgpos - 2)%14;
	for(var i in game.PLAYER_LIST){
		game.PLAYER_LIST[i].update();
	}
	pipes.update();
	if(game.playersDead>= game.playersInit.length){
		game.playersDead=0;
		game.currentState = game.states.Score;
		for(var i in game.PLAYER_LIST){
			if(game.PLAYER_LIST[i].score > game.PLAYER_LIST[i].best){
				game.PLAYER_LIST[i].best = game.PLAYER_LIST[i].score;
			}
		}
		console.log("currentState changed to Score");
		game.rdyPlayers=0;
		game.splashPlayers=0;
	}
	sendData();
}

function updateWaitingRoom(){
	game.frames++;
	for(var i in game.PLAYER_LIST){
		game.PLAYER_LIST[i].update();
	}
	if(countdown.isOn == true){
		countdown.tick();
	}
	sendData();
}

function getId(){
	for(var i=0;i<game.playersInit.length;i++){
		if(game.playersInit[i].taken==false){
			game.playersInit[i].taken=true;
			return i;
		}
	}
	return -1;
}
function sendData(){
	for(var i in game.SOCKET_LIST){
		var socket = game.SOCKET_LIST[i];
		var players = [];
		for(var j in game.PLAYER_LIST){
			var player = game.PLAYER_LIST[j];
			if(player.id != socket.id)
				players.push(player);
		}
		var pack = {
			yourbird : game.PLAYER_LIST[socket.id],

			players:players,
			frames: game.frames,
			fgpos:game.fgpos,
			countdown : {count:countdown.isOn,digit:countdown.digit},
			currentState:game.currentState,
			pipes : pipes,
			rdy : game.rdyPlayers
		};
		socket.emit("update",pack);
	}
}
