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

		/*
		const botName = this.core.username;
		this.systemMessageRules = [
			`${botName} is a fictional character`,
			`${botName} is not an AI and does not answer question like an AI`,
			`${botName} is chatting in an 18+ livestream`,
			`${botName} always gives a decisive answer to any question`,
			`${botName} adjusts to the conversation`,
			`${botName} is a little sassy`,
			`${botName} is not prudish and will not tell people to stay PG13`,
			`${botName} is very opinionated`,
			`${botName} writes short responses`,
			`Respond to all prompts acting as the character ${botName}`
		];
		*/

		this.baseSystemMessage =
			`Your name is ${this.core.username}. ` +
			"You are a gamer in an 18+ Twitch chat. " +
			"You are very opinionated. " +
			"You respond decisively. " +
			"You are not an AI. " +
			"You are a little cheeky. " +
			"You are allowed to talk about mature subjects. ";

		this.commandSystemMessage = "";
		this.maxTokens = 100;
		this.frequencyPenalty = 0.5;
		this.temperature = 1.2;

		this.messages = [];
		this.messageHistoryLength = 20;
		this.replyToMentions = true;

		this.chatModel = "gpt-3.5-turbo-0125";
		this.completionModel = "";

		this.totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

		this.usernamePrefixRegex = new RegExp( `.*(${this.core.username}):\\s*`, "i" );

		// botCore.commands.registerCommand( "!askgpt", "all", this.askGPT.bind( this ) );

		botCore.commands.registerCommand( "!setsystem", "mod", this.setSystemMessage.bind( this ) );
		botCore.commands.registerCommand( "!actlike", "all", this.actLike.bind( this ) );

		botCore.client.on( "chat", this.onChat.bind( this ) );

		botCore.on( "shutdown", () => {
			console.log( "\nTOKEN STATISTICS:" );
			this.logUsage( this.totalUsage );
			console.log( "\n" );
		})
	}

	setSystemMessage( channel, userstate, args )
	{
		this.commandSystemMessage = args.join( ' ' );
		console.log( `set command system message to "${this.commandSystemMessage}"` );
	}

	actLike( channel, userstate, args )
	{
		this.commandSystemMessage = "act like " + args.join( ' ' );
		console.log( `set command system message to "${this.commandSystemMessage}"` );
	}
	
	buildMessageList()
	{
		const systemMessage = this.baseSystemMessage + this.commandSystemMessage;
		let list = [ { role: "system", content: systemMessage } ];
		return list.concat( this.messages );
	}
	
	buildCompletionPromptMessageList()
	{
		const systemMessage = this.baseSystemMessage + this.commandSystemMessage;
		
		let content = `Complete the following text chat. Only reply to the latest message directed at ${this.core.username}:\n\n`;
		for( const entry of this.messages )
		{
			content += `${entry.name}: ${entry.content}\n`;
		}
		content += `${this.core.username}: `;
		
		
		return [ { role: "system", content: systemMessage }, { role: "user", content } ];
	}

	async onChat( channel, userstate, content, self )
	{
		const role = self ? "assistant" : "user";
		this.recordMessage( role, content, userstate.username );

		if ( this.replyToMentions && !self && findUserMention( content, this.core.username ) )
		{
			let reply = await this.chatCompletion( this.buildMessageList() );
			if ( !reply )
				return;

			// remove any "... botname: " prefix added by the AI
			// reply = reply.replace( this.usernamePrefixRegex, "" ).trim();
			// if ( reply.length == 0 )
			// 	return;

			// mention the user if the AI didn't
			if ( !findUserMention( reply, userstate.username ) )
				reply = `@${userstate.username} ${reply}`;

			this.core.say( channel, reply );
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

		const reply = await this.textCompletion( prompt );

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
			const completion = await this.openai.createCompletion({
				model: this.completionModel,
				max_tokens: this.maxTokens,
				frequency_penalty: this.frequencyPenalty,
				temperature: this.temperature,
				prompt
			});

			const reply = completion.data.choices[0].text;

			console.log( `\nraw reply: "${reply}"` );

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

	async chatCompletion( messages )
	{
		try
		{
			const completion = await this.openai.createChatCompletion({
				model: this.chatModel,
				max_tokens: this.maxTokens,
				frequency_penalty: this.frequencyPenalty,
				temperature: this.temperature,
				messages
			});

			const reply = completion.data.choices[0].message.content;

			console.log( `\nraw reply: "${reply}"` );
			
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