const { Configuration, OpenAIApi } = require( "openai" );

class OpenAIComponent
{
	constructor( botCore, apiKey )
	{
		this.core = botCore;

		const config = new Configuration({
			apiKey
		});

		this.openai = new OpenAIApi( config );

		botCore.commands.registerCommand( "!askgpt", "all", this.askGPT.bind( this ) );
	}

	async askGPT( channel, userstate, args )
	{
		const prompt = args.join( " " );

		console.log( `AI prompt: "${prompt}"` );

		try
		{
			const response = await this.openai.createCompletion({
				model: "text-davinci-003",
				max_tokens: 100,
				prompt
			});

			this.core.say( channel, response.data.choices[0].text.trim() );
		}
		catch( err )
		{
			console.error( err );
		}

	}
};

module.exports = OpenAIComponent;