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

		this.totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

		this.usernamePrefixRegex = new RegExp( `^\\s*@?(${this.core.username}):\\s*`, "i" );
		// this.usernamePrefixRegex = /^\s*@?ericakebot:\s*/i;

		// botCore.commands.registerCommand( "!askgpt", "all", this.askGPT.bind( this ) );

		botCore.client.on( "chat", this.onChat.bind( this ) );

		botCore.on( "shutdown", () => {
			console.log( "\nTOKEN STATISTICS:" );
			this.logUsage( this.totalUsage );
			console.log( "\n" );
		})
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

	addUsage( usage )
	{
		this.totalUsage.prompt_tokens += usage.prompt_tokens;
		this.totalUsage.completion_tokens += usage.completion_tokens;
		this.totalUsage.total_tokens += usage.total_tokens;
	}

	logUsage( usage )
	{
		console.log( "prompt tokens: " + usage.prompt_tokens );
		console.log( "completion tokens: " + usage.completion_tokens );
		console.log( "total tokens: " + usage.total_tokens );
	}

	async textCompletion( prompt )
	{
		try
		{
			console.log( `\nprompt length: ${prompt.length}` );

			const completion = await this.openai.createCompletion({
				model: this.completionModel,
				max_tokens: this.maxTokens,
				frequency_penalty: 0.5,
				prompt
			});

			const reply = completion.data.choices[0].text;

			console.log( `reply: ${reply}` );

			this.logUsage( completion.data.usage );
			this.addUsage( completion.data.usage );
			
			return reply;
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

			const reply = completion.data.choices[0].message.content;

			console.log( `reply: ${reply}` );
			
			this.logUsage( completion.data.usage );
			this.addUsage( completion.data.usage );
			
			return reply;
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