const util = require("./util.js");

const USERNAME_TAG = "<username>";

const PHRASES = [ "no", "NO", "Not this time", "No pyramids!", "pyramid >:(", "Not this time", "Get yer pyramid outta here!",
	"nope", "NOPE", "lol", "gotcha", "Kappa", "RIP", "lol no", "haha", "haha, no", "I will not allow pyramids in my jurisdiction",
	"no :)", "nope :)", "No 🔺s", "We ain't in 🇪🇬", ":)", "nooooo", "NOOOOOO", "stop", "STOP", "Gotcha!" ];

class PyramidStopper
{
	constructor( botCore )
	{
		this.core = botCore;

		// config
		this.stopSize = 2;
		this.mentionChance = 0.25;

		// state
		this.username = "";
		this.token = "";
		this.currentSize = 0;

		botCore.client.on("chat", this.onChat.bind( this ) );
	}

	onChat( channel, userstate, message, self )
	{
		// parse our own messages just in case someone tries to build a pyramid off one of our messages

		const tokens = message.split(/\s+/);

		const username = userstate.username;

		if ( tokens.length == 1 )
		{
			// start new pyramid
			this.username = username;
			this.token = tokens[0];
			this.currentSize = 1;
		}
		else if ( ( tokens.length == this.currentSize + 1 ) && ( username === this.username ) && tokens.every( token => token === this.token ) )
		{
			this.currentSize = tokens.length;

			if ( this.currentSize >= this.stopSize )
				this.stopPyramid( channel, username );
		}
		else
		{
			this.username = "";
			this.token = "";
			this.currentSize = 0;
		}
	}

	stopPyramid( channel, username )
	{
		let message = util.arrayRandom( PHRASES );

		if ( util.randomChance( this.mentionChance ) )
			message = `@${username} ${message}`;

		this.core.say( channel, message );
	}
};

module.exports = PyramidStopper;