const tmi = require("tmi.js");
const EventEmitter = require("events");
const util = require("./util.js");

class BotCore extends EventEmitter
{
	constructor( username, password, options )
	{
		super();

		this.username = username;
		this.channel = options.channel;
		this.paused = false;
		this.superadmin = options.superadmin;

		const tmiOptions = {
			connection: {
				reconnect: true,
				secure: true
			},
			identity: {
				username: username,
				password: password
			},
			channels: [ options.channel ]
		};

		this.client = new tmi.client( tmiOptions );

		this.client.on( "connecting", ( address, port ) => {
			console.log( `Connecting to ${address}:${port}` );
		});

		this.client.on( "connected", ( address, port ) => {
			console.log( `Connected to ${address}:${port}` );
		});

		this.client.on( "logon", ( address, port ) => {
			console.log( `Logged onto account "${username}"` );
		});

		this.client.on( "disconnected", (reason) => {
			console.log( `Disconnected. Reason: "${reason}"` );
		});

		this.client.on( "chat", (channel, userstate, message, self) =>
		{
			// check if message is a bot command
			if ( message[0] != "!" )
				return;

			// check if user can give commands
			if ( userstate.mod === true ||
				util.strieq( userstate.username, this.channel ) ||
				util.strieq( userstate.username, this.superadmin ) )
			{
				this.parseCommand( message );
			}
		});

		this.on( "command", ( command, args ) => this.handleCommand( command, args ) );
	}
	
	say( channel, message )
	{
		console.log( `\nSaying "${message}"` );
		if ( this.paused )
		{
			console.log( `***Bot is paused***\n` );
			return;
		}
		
		this.client.say( channel, message );
		console.log( "\n" );
	}

	connect()
	{
		this.client.connect().catch( console.error );
	}

	shutdown()
	{
		this.emit( "shutdown" );
	}

	parseCommand( str )
	{
		let args = str.split( /\s+/ );
		if ( args.length == 0 )
			return;

		let command = args[0];
		if ( command[0] == "!" )
			command = command.slice( 1 );

		args.shift();

		this.emit( "command", command, args );
	}

	handleCommand( command, args )
	{
		switch( command )
		{
			case "pause":
				this.paused = true;
				console.log( "paused" );
				break;

			case "unpause":
				this.paused = false;
				console.log( "unpaused" );
				break;
		}
	}
}

module.exports = BotCore;