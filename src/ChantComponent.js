class ChantComponent
{
	constructor( botCore )
	{
		this.core = botCore;

		// config
		this.repeatCountToChant = 3;

		// state
		this.chantMessage = "";
		this.originUsername = "";
		this.messageCount = 0;
		this.lastMessage = "";

		botCore.client.on("chat", this.onChat.bind( this ));
	}

	onChat( channel, userstate, message, self )
	{
		if ( self )
			return;

		if ( message === this.lastMessage )
			return; // don't repeat chants

		if ( message === this.chantMessage )
		{
			this.messageCount++;
		}
		else
		{
			// reset potential chant message
			this.chantMessage = message;
			this.originUsername = userstate.username;
			this.messageCount = 1;
		}

		if ( this.messageCount >= this.repeatCountToChant && userstate.username !== this.originUsername )
		{
			this.lastMessage = message;
			this.core.client.say( channel, message );
		}
	}
};

module.exports = ChantComponent;