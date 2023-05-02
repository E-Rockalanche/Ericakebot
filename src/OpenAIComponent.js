const { Configuration, OpenAIApi } = require( "openai" );

const USERNAME_REGEX = /@([a-zA-Z0-9_]{4,25})/g;

function findUserMention( str, username )
{
	const matchValue = "@" + username.toLowerCase();
	const matches = str.match( USERNAME_REGEX );
	if ( matches === null )
		return false;

	return matches.find( x => x.toLowerCase() === matchValue );
}

class OpenAIComponent
{
	constructor( botCore, apiKey )
	{
		this.core = botCore;

		const config = new Configuration({
			apiKey
		});

		this.openai = new OpenAIApi( config );

		this.systemMessages = [{ role: "system", content: `Pretend to be a twitch chat user`, name: this.core.username }];
		this.messages = [];
		this.messageHistoryLength = 20;
		this.maxTokens = 120;
		this.replyToMentions = true;

		this.chatModel = "gpt-3.5-turbo";
		this.completionModel = "text-davinci-003";

		this.usernamePrefixRegex = new RegExp( `^\\s*@?(${this.core.username}):\\s*`, "i" );
		// this.usernamePrefixRegex = /^\s*@?ericakebot:\s*/i;

		// botCore.commands.registerCommand( "!askgpt", "all", this.askGPT.bind( this ) );

		botCore.client.on( "chat", this.onChat.bind( this ) );
	}

	async onChat( channel, userstate, content, self )
	{
		const role = self ? "assistant" : "user";
		this.recordMessage( role, content, userstate.username );

		if ( this.replyToMentions && !self && findUserMention( content, this.core.username ) )
		{
			let prompt = "";
			for( const entry of this.messages )
			{
				prompt += `${entry.name}: ${entry.content}\n`;
			}

			let reply = await this.textCompletion( prompt );
			if ( reply )
			{
				// remove any "BOT_NAME: " prefix added by the AI
				reply = reply.replace( this.usernamePrefixRegex, "" );

				// mention the user if the AI didn't
				if ( !findUserMention( reply, userstate.username ) )
					reply = `@${userstate.username} ${reply}`;

				this.core.say( channel, reply );
			}
		}
	}

	async askGPT( channel, userstate, args )
	{
		const prompt = args.join( " " ).trim();
		if ( newPrompt.length == 0 )
		{
			this.core.say( `@${userstate.username} please include a prompt after the command` );
			return;
		}

		const reply = await textCompletion( prompt );

		if ( reply )
			this.core.say( channel, reply );
	}

	recordMessage( role, content, name )
	{
		this.messages.push( { role, content, name } );

		while ( this.messages.length > this.messageHistoryLength )
			this.messages.shift();
	}

	async textCompletion( prompt )
	{
		try
		{
			console.log( `text completion prompt: "${prompt}"` );

			const completion = await this.openai.createCompletion({
				model: this.completionModel,
				max_tokens: this.maxTokens,
				frequency_penalty: 0.0,
				prompt
			});
			
			return completion.data.choices[0].text;
		}
		catch( error )
		{
			if ( error.response )
			{
				console.error( error.response.status );
				console.error( error.response.data );
			}
			else
			{
				console.error( error.message );
			}
			return null;
		}
	}

	async chatCompletion( chatMessages )
	{
		try
		{
			const messages = this.systemMessages.concat( chatMessages );

			const completion = await this.openai.createChatCompletion({
				model: this.chatModel,
				messages
			});

			return completion.data.choices[0].message.content;
		}
		catch( error )
		{
			if ( error.response )
			{
				console.error( error.response.status );
				console.error( error.response.data );
			}
			else
			{
				console.error( error.message );
			}
			return null;
		}
	}
};

module.exports = OpenAIComponent;