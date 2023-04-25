const tmi = require("tmi.js");

const util = require("./util.js");
const CommandRegistry = require("./CommandRegistry.js");

const EventEmitter = require("events");
const assert = require("assert");

const TwitchMaxMessageLength = 500;

class BotCore extends EventEmitter
{
	constructor( username, password, options )
	{
		super();

		this.username = username;
		this.channel = options.channel;

		this.commands = new CommandRegistry();

		this.muted = false;
		this.maxMessageLength = TwitchMaxMessageLength;

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
			console.log( `Logged on to account "${username}"` );
		});

		this.client.on( "disconnected", (reason) => {
			console.log( `Disconnected. Reason: "${reason}"` );
		});

		this.client.on( "chat", (channel, userstate, message, self) =>
		{
			// handle commands
			if ( !self )
				this.commands.handleCommand( channel, userstate, message );
		});

		this.commands.registerCommand( "!mute", "mod", () =>
		{
			this.muted = true;
			console.log( "Muted" );
		});

		this.commands.registerCommand( "!unmute", "mod", () => {
			this.muted = false;
			console.log( "Unmuted" );
		});

		this.commands.registerCommand( "!setmaxmessagelength", "mod", ( channel, userstate, args ) => {
			const length = parseInt( args[0] );
			this.setMaxMessageLength( length );
			console.log( `Set max message length to ${length}` );
		});

		let imDadJokeFn = (channel, userstate, args) => {
			this.say( channel, `Hi ${args.join(' ')}, I'm ${this.username}!` );
		};
		this.commands.registerCommand( "I'm", "all", imDadJokeFn );
		this.commands.registerCommand( "Im", "all", imDadJokeFn );
	}

	setMaxMessageLength( length )
	{
		this.maxMessageLength = Math.Clamp( length, 0, TwitchMaxMessageLength );
	}
	
	say( channel, message )
	{
		if ( this.muted )
			return;

		if ( message.length > this.maxMessageLength )
		{
			console.warn( `Message exceeds max length [${this.maxMessageLength}]` );
			message = message.substring( 0, this.maxMessageLength );
		}
		
		console.log( `Saying "${message}"` );
		this.client.say( channel, message );
	}

	connect()
	{
		this.client.connect().catch( console.error );
	}

	shutdown()
	{
		this.say( this.channel, "Goodbye!" );
		this.emit( "shutdown" );
	}
}

module.exports = BotCore;