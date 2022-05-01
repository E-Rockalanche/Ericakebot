const tmi = require("tmi.js");
const EventEmitter = require("events");

class BotCore extends EventEmitter
{
	constructor( username, password, channel )
	{
		super();

		this.username = username;
		this.channel = channel;

		const options = {
			connection: {
				reconnect: true,
				secure: true
			},
			identity: {
				username: username,
				password: password
			},
			channels: [ channel ]
		};

		this.client = new tmi.client( options );

		this.client.on( "connecting", ( address, port ) => {
			console.log( `Connecting to ${address}:${port}` );
		});

		this.client.on( "connected", ( address, port ) => {
			console.log( `Connected to ${address}:${port}` );
		});

		this.client.on( "logon", ( address, port ) => {
			console.log( `Logged onto account "${username}"` );
		});

		this.client.on("disconnected", (reason) => {
			console.log( `Disconnected. Reason: "${reason}"` );
		});
	}

	connect()
	{
		this.client.connect().catch( console.error );
	}

	shutdown()
	{
		this.emit( "shutdown" );
	}
}

module.exports = BotCore;