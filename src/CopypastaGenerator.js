const MarkovChain = require("./markovchain.js");
const util = require("./util.js");

const PUNCTUATION_REGEX = /[\.\,\?\!\:\;]+/g;

const USERNAME_REGEX = /^@([a-zA-Z0-9_]{4,25})$/;

const URL_REGEX = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g;

const STREAMER_TAG = "<streamer>";
const USER_TAG_REGEX = /^<username(\d+)?>$/;

const URL_REPLACEMENT = "<shady-url-here>";

const END_TOKEN = "";

const MAX_TWITCH_MESSAGE_LENGTH = 510;

function createUserTag( num )
{
	return `<username${num}>`;
}

class RandomUsernameSelector
{
	constructor( usernames, replyToUsername )
	{
		this.available = [...usernames];
		this.taken = new Map();
		this.replyToUsername = replyToUsername;
	}

	get( tag = "" )
	{
		let availableIndex = -1;

		// check if we already chose a username for the given tag
		let username = this.taken.get( tag );
		if ( username !== undefined )
		{
			return username;
		}

		// check if there's a username we must use
		else if ( this.replyToUsername !== undefined )
		{
			username = this.replyToUsername;
			this.replyToUsername = undefined;

			availableIndex = this.available.findIndex( x => util.strieq( x, username ) );
		}

		// check if there are any usernames still available
		else if ( this.available.length == 0 )
		{
			return undefined;
		}

		// choose a random username
		else
		{
			availableIndex = Math.floor( Math.random() * this.available.length );
			username = this.available[ availableIndex ];
		}

		// remove username from available set
		if ( availableIndex >= 0 )
			util.arrayBackSwapEraseAt( this.available, availableIndex );
		else
			console.warn( `RandomUsernameSelector.get -- username "${username}" does not exist in available set` );

		// associate username with given tag
		this.taken.set( tag, username );

		return username;
	}
}

class CopypastaGenerator
{
	constructor( botCore )
	{
		this.core = botCore;

		// config
		this.config = {
			allowURLs: false,                            // allows bot to repeat URLs
			weightFunction: messageTokenLength => 1,     // function to transform token length to markov transition weight
			keylength: 3,                                // markov chain token key length
			minTokenLength: 1,                           // minimum message token length to parse
			maxMessageLength: MAX_TWITCH_MESSAGE_LENGTH, // max message length allowed to say
			messageCountDelay: 10,                       // message count delay between chatting
			messageDelaySeconds: 90,                     // time delay between chatting
			messageGenerationRetries: 4,                 // amount of extra times the bot tries to generate a message before giving up
			allowReplies: true,                          // allow bot to reply to bot mentions
			replyDelaySeconds: 10                        // time delay between sending replies
		};

		// state
		this.markovChain = new MarkovChain();
		this.usernames = [];
		this.messageCountdown = 0;
		this.messageTimer = null;
		this.lastReplyTimeMS = 0;
		this.chatHistory = []; // history of tokens and weights put into the markov chain so they can be removed later

		let self = this;

		botCore.client.on("chat", (channel, userstate, message, self) => this.onChat(channel, userstate, message, self) );

		botCore.client.on("ban", (channel, username, reason, userstate) =>
		{
			console.log( `\n${username} was banned. Reason: ${reason}` );
			this.removeChatHistory( username );
		});

		botCore.client.on("messagedeleted", (channel, username, message, userstate) =>
		{
			console.log( `\nMessage from ${username} was deleted: "${message}"` );
			this.removeChatHistory( username );
		});

		botCore.client.on("timeout", (channel, username, reason, duration, userstate) =>
		{
			console.log( `\n${username} timed out for ${duration} seconds` );
			this.removeChatHistory( username );
		});
	}

	onChat( channel, userstate, message, self )
	{
		if ( self )
		{
			this.onSelfChat();
			return;
		}

		// ignore commands
		if ( message[0] === "!" )
			return;
		
		// reduce message countdown
		if ( this.messageCountdown > 0 )
			this.messageCountdown--;

		// add to set of usernames
		util.arrayPushUnique( this.usernames, userstate.username );

		// add message to markov ruleset
		const wasMentioned = this.parseMessage( userstate.username, message );

		// check if we should replay
		if ( wasMentioned && this.canReply() )
		{
			this.sayCopypasta( userstate.username );
			this.lastReplyTimeMS = Date.now();
			return;
		}

		// check if we can generate a message
		if ( this.messageCountdown === 0 && this.messageTimer === null )
		{
			this.sayCopypasta();
		}
	}

	canReply()
	{
		return this.config.allowReplies && ( Date.now() >= this.lastReplyTimeMS + this.config.replyDelaySeconds * 1000 );
	}

	sayCopypasta( replyToUsername = undefined )
	{
		const maxTries = this.config.messageGenerationRetries + 1;

		let triesLeft = maxTries;
		let message = "";
		while( triesLeft > 0 && message === "" )
		{
			triesLeft--;
			message = this.generateMessage( replyToUsername );
		}

		if ( message )
		{
			console.log( `\n${this.core.username}:\t${message}\n` );

			this.core.client.say( this.core.channel, message );
			this.onSelfChat();
			return true;
		}
		else
		{
			console.warn( `CopypastaGenerator.sayCopypasta -- Failed to generate a message in ${maxTries} tries` );
			return false;
		}
	}

	onSelfChat()
	{
		// reset countdown
		this.messageCountdown = this.config.messageCountDelay;

		// schedule next message
		this.scheduleSayCopypasta();
	}

	scheduleSayCopypasta()
	{
		// cancel current timer
		if ( this.messageTimer !== null )
			clearTimeout( this.messageTimer );

		// schedule new timer
		this.messageTimer = setTimeout( this.#onMessageTimer.bind( this ), this.config.messageDelaySeconds * 1000 );
	}

	generateMessage( replyToUsername = undefined )
	{
		let message = "";
		const prevTokens = [];

		const usernameSelector = new RandomUsernameSelector( this.usernames, replyToUsername );

		while( true )
		{
			let token = this.markovChain.transitionFrom( this.#createKey( prevTokens ) );
			if ( token === END_TOKEN )
				break; // finished

			// append token to key before transforming token
			prevTokens.push( token );

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
				const username = usernameSelector.get( token );
				if ( username === undefined )
					return ""; // failed to find another suitable username

				token = `@${username}`;
			}

			// conditionally add a space before the next token
			if ( message.length > 0 && !isPunctuation )
				message += " ";

			// append token to message
			message += token;

			// early out if message is too long
			if ( message.length > this.config.maxMessageLength )
				return "";
		}

		// check if we still need to use the reply username
		if ( usernameSelector.replyToUsername !== undefined )
		{
			message = `@${replyToUsername} ${message}`;

			// check if this brings it over the max length
			if ( message > this.config.maxMessageLength )
				return "";
		}

		return message;
	}

	// returns true if bot name was mentioned. Username should not be a display name
	parseMessage( username, message )
	{
		const { tokens, wasMentioned } =  this.#tokenize( message );

		if ( tokens.length >= this.config.minTokenLength )
		{
			const weight = this.config.weightFunction( tokens.length );
			if ( weight > 0 )
			{
				this.#parseTokens( tokens, weight, this.markovChain.addTransition.bind( this.markovChain ) );
				this.chatHistory.push( { username, tokens, weight } );

				console.log(`${username}:\t${tokens.join( " " )}` );
			}
		}

		return wasMentioned;
	}

	// username to remove should not be a display name
	removeChatHistory( usernameToRemove )
	{
		console.log( `\nRemoving chat history for ${usernameToRemove}` );

		for( let i = 0; i < this.chatHistory.length; )
		{
			const { username, tokens, weight } = this.chatHistory[ i ];
			if ( util.strieq( username, usernameToRemove ) )
			{
				this.#removeTokens( entry.tokens, weight );
				this.chatHistory.splice( i, 1 );
			}
			else
			{
				i++;
			}
		}
	}

	// returns object containing tokens and other stats
	#tokenize( message )
	{
		let wasMentioned = false;

		// remove URLs
		if ( !this.config.allowURLs )
		{
			message = message.replace( URL_REGEX, URL_REPLACEMENT );
		}

		const tokens = message.replace( PUNCTUATION_REGEX, ( match ) => { return " " + match + " "; } ) // add spaces around puncuation
			.trim()
			.split( /\s+/ ); // split into array of tokens
		
		const usernameTags = new Map();
		const getTagForUsername = ( username ) =>
		{
			let tag = usernameTags.get( username );
			if ( tag === undefined )
			{
				if ( util.strieq( username, this.core.channel ) )
					tag = STREAMER_TAG;
				else
					tag = createUserTag( usernameTags.size );

				usernameTags.set( username, tag );
			}
			return tag;
		};

		// replace username mentions with tags
		tokens.forEach( ( token, i, arr ) =>
		{
			const result = token.match( USERNAME_REGEX );
			if ( result !== null )
			{
				const username = result[1].toUpperCase(); // username is first capture group

				// check if bot name was mentioned
				if ( username === this.core.username.toUpperCase() )
					wasMentioned = true;

				// convert username to tag
				arr[i] = getTagForUsername( username );
			}
		} );

		return { tokens, wasMentioned };
	}

	#parseTokens( tokens, weight, transitionFunc )
	{
		if ( tokens.length == 0 )
			return;

		const prevTokens = [];
		for( let token of tokens )
		{
			transitionFunc( this.#createKey( prevTokens ), token, weight );
			prevTokens.push( token );
		}

		transitionFunc( this.#createKey( prevTokens ), END_TOKEN, weight );
	}

	#createKey( tokens )
	{
		return tokens.slice( -this.config.keyLength ) // take last few tokens to use for key
			.join( " " )
			.toUpperCase()
			.replace( /'([A-Z])/g, (match, p1) => p1 ) // remove quotes from contractions
			.trim();
	}

	#onMessageTimer()
	{
		this.messageTimer = null;

		if ( this.messageCountdown <= 0 )
			this.sayCopypasta();
	}

	// username should not be a display name
	#addChatHistory( username, tokens, weight )
	{
		this.chatHistory.push( { username, tokens, weight } );
	}

	#removeTokens( tokens, weight )
	{
		console.log( `Removing "${tokens.join( " " )}"` );
		this.#parseTokens( tokens, weight, this.markovChain.removeTransition.bind( this.markovChain ) );
	}
};

module.exports = CopypastaGenerator;