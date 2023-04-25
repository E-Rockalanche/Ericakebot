class ChantComponent
{
	constructor( botCore )
	{
		this.core = botCore;

		// config
		this.requiredChantCount = 3; // how many time to see chant
		this.chatHistorySize = 10; // out of how many messages

		// state
		this.lastMessage = "";
		this.chatHistory = [];

		botCore.client.on( "chat", this.onChat.bind( this ) );
	}

	onChat( channel, userstate, message, self )
	{
		if ( self )
		{
			this.lastMessage = message.toUpperCase();
		}

		// ignore commands
		const c = message[0];
		if ( c == '/' || c == '.' || c == '!' )
			return;

		const username = userstate.username;
		const messageUpper = message.trim().toUpperCase();

		// add message to history
		this.chatHistory.push( { username, messageUpper } );
		while ( this.chatHistory.length > this.chatHistorySize )
			this.chatHistory.shift();

		// ignore last chant message
		if ( messageUpper === this.lastMessage )
			return;

		// count recent occurences by unique users
		let chantCount = 0;
		const chanters = new Set();
		this.chatHistory.forEach( record =>
		{
			if ( record.messageUpper === messageUpper && !chanters.has( record.username ) )
			{
				chanters.add( record.username );
				chantCount++;
			}
		} );

		if ( chantCount >= this.requiredChantCount )
		{
			this.lastMessage = messageUpper;
			this.core.say( channel, message );
		}
	}
};

module.exports = ChantComponent;