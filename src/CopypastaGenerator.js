const MarkovChain = require("./markovchain.js");
const util = require("./util.js");

const PUNCTUATION_REGEX = /[\.\,\?\!\:\;]+/g;

const USERNAME_REGEX = /^@([a-zA-Z0-9_]{4,25})$/;

const URL_REGEX = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g;

const STREAMER_TAG = "<streamer>";
const USER_TAG_REGEX = /^<username(\d+)?>$/;

const URL_REPLACEMENT = "<SHADY_URL>";

const END_TOKEN = "";

function createUserTag( num )
{
	return `<username${num}>`;
}

class RandomUsernameSelector
{
	constructor( usernames )
	{
		this.available = [...usernames];
		this.taken = new Map();
	}

	get( tag = "" )
	{
		// check if we already chose a username for the given tag
		let username = this.taken.get( tag );
		if ( username !== undefined )
			return username;

		// check if there are any usernames still available
		if ( this.available.length == 0 )
			return undefined;

		// choose a random username
		const index = Math.floor( Math.random() * this.available.length );
		username = this.available[ index ];

		// set username to taken
		this.available.splice( index, 1 );
		this.taken.set( tag, username );

		return username;
	}
}

class CopypastaGenerator
{
	constructor( botCore )
	{
		this.core = botCore;
		this.allowURLs = false;
		this.weightFunction = x => 1;
		this.keyLength = 3;
		this.maxMessageLength = 510; // max Twitch message length

		this.markovChain = new MarkovChain();
		this.usernames = [];

		botCore.client.on("chat", this.onChat.bind( this ) );
	}

	onChat( channel, userstate, message, self )
	{
		if ( self )
			return;

		// add to set of usernames
		util.arrayPushUnique( this.usernames, userstate['display-name'] );

		// add message to markov ruleset
		this.parseMessage( message );

		const newMessage = this.generateMessage();
		if ( newMessage !== undefined )
		{
			this.core.client.say( channel, newMessage );
		}
	}

	generateMessage()
	{
		let message = "";
		const prevTokens = [];

		const usernameGenerator = new RandomUsernameSelector( this.usernames );

		while( true )
		{
			let token = this.markovChain.transitionFrom( this.#createKey( prevTokens ) );
			if ( token === END_TOKEN )
				break; // finished

			// append token to key
			this.#pushPrevToken( prevTokens, token );

			// check for special tokens
			let isPunctuation = false;
			if ( PUNCTUATION_REGEX.test( token ) )
			{
				isPunctuation = true;
			}
			else if ( token === STREAMER_TAG )
			{
				token = `@${this.core.channel}`;
			}
			else if ( USER_TAG_REGEX.test( token ) )
			{
				const username = usernameGenerator.get( token );
				if ( username === undefined )
					return undefined; // failed to find another username

				token = `@${username}`;
			}

			// conditionally add a space before the next token
			if ( message.length > 0 && !isPunctuation )
				message += " ";

			// update state with new token
			message += token;

			// check if message is too long
			if ( message.length > this.maxMessageLength )
				return undefined;
		}

		return message;
	}

	parseMessage( message )
	{
		this.#parseTokens( this.#tokenize( message ), this.markovChain.addTransition.bind( this.markovChain ) );
	}

	removeMessage( message )
	{
		this.#parseTokens( this.#tokenize( message ), this.markovChain.removeTransition.bind( this.markovChain ) );
	}

	#tokenize( message )
	{
		// remove URLs
		if ( !this.allowURLs )
		{
			message = message.replace( URL_REGEX, URL_REPLACEMENT );
		}

		const tokens = message.replace( PUNCTUATION_REGEX, ( match ) => { return " " + match + " "; } ) // add spaces around puncuation
			.trim()
			.split( /\s+/ ); // split into array of tokens

		const usernameTags = new Map();
		const getTagForUsername = ( username ) =>
		{
			let tag = usernameTags.get( username.toLowerCase() );
			if ( tag === undefined )
			{
				if ( util.strieq( username, this.core.channel ) )
					tag = STREAMER_TAG;
				else
					tag = createUserTag( usernameTags.size );

				usernameTags.set( username.toLowerCase(), tag );
			}
			return tag;
		};

		// replace username mentions with tags
		tokens.forEach( ( token, i, arr ) =>
		{
			const result = token.match( USERNAME_REGEX );
			if ( result !== null )
			{
				const username = result[1]; // username is first capture group
				arr[i] = getTagForUsername( username );
			}
		} );

		return tokens;
	}

	#parseTokens( tokens, transitionFunc )
	{
		if ( tokens.length == 0 )
			return;

		const weight = this.weightFunction( tokens.length );
		if ( weight <= 0 )
			return;

		const prevTokens = [];
		for( let token of tokens )
		{
			transitionFunc( this.#createKey( prevTokens ), token, weight );
			this.#pushPrevToken( prevTokens, token );
		}

		transitionFunc( this.#createKey( prevTokens ), END_TOKEN, weight );
	}

	#createKey( tokens )
	{
		return tokens.join( " " )
			.toUpperCase()
			.replace( /'([A-Z])/g, (match, p1) => p1 ) // remove quotes from contractions
			.trim();
	}

	#pushPrevToken( prevTokens, token )
	{
		if ( prevTokens.length == this.keyLength )
			prevTokens.shift();

		prevTokens.push( token );
	}
};

module.exports = CopypastaGenerator;