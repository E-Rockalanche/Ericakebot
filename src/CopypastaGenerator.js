const MarkovChain = require("./markovchain.js");
const util = require("./util.js");
const fs = require("fs");

const PUNCTUATION_REPLACE_REGEX = /[\.\,\?\!\:\;]+\s/g // any number of punctuation followed by whitespace
const PUNCTUATION_TOKEN_REGEX = /^[\.\,\?\!\:\;]+$/; // any number of punctuation

const USERNAME_REGEX = /^@([a-zA-Z0-9_]{4,25})$/;

const URL_REGEX = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g;

const STREAMER_TAG = "<streamer>";
const USER_TAG_REGEX = /^<username(\d+)?>$/;

const URL_REPLACEMENT = " <shady-url-here> ";

const END_TOKEN = "";

const MAX_TWITCH_MESSAGE_LENGTH = 510;

const COMMAND_REGEX = /^[!/]\w/;

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

const DEFAULT_CONFIG = {
	allowURLs: false,                            // allows bot to repeat URLs
	weightFunction: tokenLength => 1,            // function to transform token length to markov transition weight
	keyLength: 3,                                // markov chain token key length
	minTokenLength: 1,                           // minimum message token length to parse
	maxMessageLength: MAX_TWITCH_MESSAGE_LENGTH, // max message length allowed to say
	messageCountDelay: 15,                       // message count delay between chatting
	messageDelaySeconds: 180,                    // time delay between chatting
	messageGenerationRetries: 4,                 // amount of extra times the bot tries to generate a message before giving up
	allowReplies: true,                          // allow bot to reply to bot mentions
	replyDelaySeconds: 20,                       // time delay between sending replies
	useEqualWeights: false                       // gives every markov transition from each state the same probability
};

class CopypastaGenerator
{
	constructor( botCore, config = {} )
	{
		this.core = botCore;

		// config
		this.config = {};
		Object.assign( this.config, DEFAULT_CONFIG ); // copy defaults
		Object.assign( this.config, config ); // copy overrides

		// state
		this.markovChain = new MarkovChain();
		this.totalMessagesWeight = 0; // use to calculate markov chain entropy
		this.usernames = [];
		this.messageCountdown = this.config.messageCountDelay;
		this.messageTimer = null;
		this.lastReplyTimeMS = 0;
		this.chatHistory = []; // history of tokens and weights put into the markov chain so they can be removed later

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
		
		botCore.client.on("subgift", (channel, username, streakMonths, receipient, methods, userstate) =>
		{
			if ( util.strieq( receipient, this.core.username ) )
			{
				this.core.say( channel, `@${username} Thanks for the sub!!!` );
			}
		});
		
		botCore.client.on("whisper", (from, userstate, message, self) =>
		{
			if ( self )
				return;
			
			this.core.client.whisper( from, `Hi! I'm ${this.core.channel}, a chat bot developed by Ericake. I read messages in chat and use them to randomly generate new messages using a Markov chain. I also block pyramids and participate in chants :)` );
		});

		botCore.on("command", ( command, args ) => this.handleCommand( command, args ) );

		botCore.on("shutdown", () => this.saveChatHistory() );

		this.loadChatHistory();

		this.scheduleSayCopypasta();
	}

	onChat( channel, userstate, message, self )
	{
		if ( self )
		{
			this.onSelfChat();
			return;
		}

		// ignore commands
		if ( COMMAND_REGEX.test( message ) )
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
			this.core.say( this.core.channel, message );
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
			let token = this.markovChain.transitionFrom( this.#createKey( prevTokens ), this.config.useEqualWeights );
			if ( token === END_TOKEN )
				break; // finished

			// append token to key before transforming token
			prevTokens.push( token );

			// check for special tokens
			let isPunctuation = false;
			if ( PUNCTUATION_TOKEN_REGEX.test( token ) )
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
	parseMessage( username, message, addToHistory = true )
	{
		console.log(`${username}:\t"${message}"` );

		if ( addToHistory )
			this.#addChatHistory( username, message );

		const { tokens, wasMentioned } = this.#tokenize( message );

		this.#processTokens( tokens, this.markovChain.addTransition.bind( this.markovChain ) );

		return wasMentioned;
	}

	// username to remove should not be a display name
	removeChatHistory( usernameToRemove )
	{
		console.log( `\nRemoving chat history for ${usernameToRemove}` );

		for( let i = 0; i < this.chatHistory.length; )
		{
			const { username, message } = this.chatHistory[ i ];
			if ( util.strieq( username, usernameToRemove ) )
			{
				this.#removeMessage( message );
				this.chatHistory.splice( i, 1 );
			}
			else
			{
				i++;
			}
		}

		console.log("\n");
	}

	saveChatHistory()
	{
		const path = this.#getSaveDirectory();
		const filename = this.#getSaveFilename();

		fs.mkdirSync( path, { recursive : true } );

		const filePath = path + filename;
		fs.writeFileSync( filePath, JSON.stringify( this.chatHistory ) );

		console.log( `Saved chat history to "${filePath}"` );
	}

	loadChatHistory()
	{
		const filePath = this.#getSaveDirectory() + this.#getSaveFilename();
		if ( !fs.existsSync( filePath ) )
			return;
		
		const json = fs.readFileSync( filePath, "utf8" );
		const history = JSON.parse( json );
		for( const { username, message } of history )
		{
			this.parseMessage( username, message );
		}

		console.log( `Loaded chat history from "${filePath}"` );
	}

	loadCorpus( filename )
	{
		if ( !fs.existsSync( filename ) )
		{
			console.error( `Corpus file "${filename}" does not exist` );
			return false;
		}

		const CORPUS_USERNAME = "";
		const ADD_TO_HISTORY = false;

		const messages = fs.readFileSync( filename, "utf8" ).split( /\n/ );
		for( const message of messages )
		{
			this.parseMessage( CORPUS_USERNAME, message, ADD_TO_HISTORY );
		}

		console.log( `Loaded corpus from "${filename}"` );
		return true;
	}

	// returns entropy in terms of bits
	calculateEntropy()
	{
		// sum weighted average of entropy
		let entropy = 0;
		this.markovChain.matrix.forEach( (row, state) =>
		{
			// ignore inital state since it has high entropy and doesn't contribute to randomness of gernated message
			if ( state === "" )
				return;

			entropy += ( row.totalWeight / this.totalMessagesWeight ) * this.markovChain.calculateRowEntropy( row );
		});
		return entropy;
	}

	handleCommand( command, args )
	{
		switch( command )
		{
			case "entropy":
			{
				const entropy = this.calculateEntropy();
				console.log( `Entropy: ${entropy}\n` );
				break;
			}

			case "generate":
			{
				this.sayCopypasta();
				break;
			}
			
			case "test":
			{
				const count = ( args.length > 0 ) ? parseInt( args[0] ) : 1;
				console.log( `\nTesting ${count} messages:` );
				for( let i = 0; i < count; ++i )
				{
					let message = "";
					while( !message )
						message = this.generateMessage();
					
					console.log( `Generated "${message}"` );
				}
				console.log( '\n' );
				break;
			}
			
			case "say":
			{
				// bypass core.say
				this.core.client.say( this.core.channel, args.join( " " ) );
				break;
			}

			case "record":
			{
				this.parseMessage( "", args.join( " " ) );
				break;
			}

			case "useequalweights":
			{
				this.config.useEqualWeights = ( args[0].toUpperCase() === "TRUE" );
				console.log( `Use equal weights: ${this.config.useEqualWeights}` );
				break;
			}
		}
	}

	#getSaveDirectory()
	{
		return process.env.APPDATA + "/ericakebot/";
	}

	#getSaveFilename()
	{
		return this.core.channel + "-chathistory.json";
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

		const tokens = message.replace( PUNCTUATION_REPLACE_REGEX, ( match ) => { return " " + match + " "; } ) // add spaces around puncuation
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

		const botUsernameUpper = this.core.username.toUpperCase();

		// replace username mentions with tags
		tokens.forEach( ( token, i, arr ) =>
		{
			let username = null;

			if ( util.strieq( token, botUsernameUpper ) )
			{
				// replace non-mentions to bot name
				username = botUsernameUpper;
			}
			else
			{
				const result = token.match( USERNAME_REGEX );
				if ( result !== null )
				{
					// username is first capture group
					username = result[1].toUpperCase();

					// check if bot name was mentioned
					wasMentioned = wasMentioned || ( username === botUsernameUpper );
				}
			}

			// convert username to tag
			if ( username !== null )
				arr[i] = getTagForUsername( username );
		} );

		return { tokens, wasMentioned };
	}

	#processTokens( tokens, addToMarkovChain = true )
	{
		// ignore messages that are too short
		if ( tokens.length < this.config.minTokenLength )
			return;

		// ignore message that will have no weight in the markov chain
		const weight = this.config.weightFunction( tokens.length );
		if ( weight <= 0 )
			return;

		let processTransition;
		if ( addToMarkovChain )
		{
			processTransition = this.markovChain.addTransition.bind( this.markovChain );
			this.totalMessagesWeight += weight;
		}
		else
		{
			processTransition = this.markovChain.removeTransition.bind( this.markovChain );
			this.totalMessagesWeight -= weight;
		}

		// add/remove transitions
		const prevTokens = [];
		for( let token of tokens )
		{
			processTransition( this.#createKey( prevTokens ), token, weight );
			prevTokens.push( token );
		}

		processTransition( this.#createKey( prevTokens ), END_TOKEN, weight );
	}

	#createKey( tokens )
	{
		return tokens.slice( -this.config.keyLength ) // take last few tokens to use for key
			.join( " " )
			.toUpperCase()
			.replace( /['’]([A-Z])/g, (match, p1) => p1 ) // remove single quotes from contractions
			.trim();
	}

	#removeMessage( message )
	{
		console.log( `Removing "${message}"` );
		const { tokens } = this.#tokenize( message );
		this.#processTokens( tokens, this.markovChain.removeTransition.bind( this.markovChain ) );
	}

	#onMessageTimer()
	{
		this.messageTimer = null;

		if ( this.messageCountdown <= 0 )
			this.sayCopypasta();
	}

	// username should not be a display name
	#addChatHistory( username, message )
	{
		this.chatHistory.push( { username, message } );
	}
};

module.exports = CopypastaGenerator;