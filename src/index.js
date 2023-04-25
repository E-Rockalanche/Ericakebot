"use strict"

// add variables from file ".env" to process.env
require("dotenv").config();

const options = require("./CommandLineArgs.js").parse( process.argv );
console.log( options );

const readline = require("readline");

const BotCore = require("./botcore.js");
const CopypastaGenerator = require("./CopypastaGenerator.js");
const PyramidStopper = require("./PyramidStopper.js");
const ChantComponent = require("./ChantComponent.js");
const OpenAIComponent = require("./OpenAIComponent.js");

// INITIALIZE

const botCore = new BotCore( process.env.BOT_USERNAME, process.env.BOT_OAUTH, options );

const copypastaGeneratorOptions = {
	keyLength: 3,
	minTokenLength: 1,
	maxMessageLength: 500,
	useEqualWeights: false,
	weightFunction: x => x
};
const copypastaGenerator = new CopypastaGenerator( botCore, copypastaGeneratorOptions );
if ( options.corpus )
	copypastaGenerator.loadCorpus( options.corpus );

const pyramidStopper = new PyramidStopper( botCore );

const chantComponent = new ChantComponent( botCore );

let openAIComponent = null;
if ( process.env.OPENAI_API_KEY )
	openAIComponent = new OpenAIComponent( botCore, process.env.OPENAI_API_KEY );

// RUN

botCore.connect();

const cli = readline.createInterface( process.stdin, process.stdout );

cli.on("line", str =>
{
	try
	{
		let userstate = {};
		botCore.commands.handleCommand( botCore.channel, userstate, str, false );
	}
	catch( error )
	{
		console.error( error );
	}
});

cli.on("SIGINT", () => process.exit(0) );
cli.on("SIGTERM", () => process.exit(0) );
cli.on("SIGHUP", () => process.exit(0) );

process.on( "SIGINT", () => process.exit(0) );
process.on( "SIGTERM", () => process.exit(0) );
process.on( "SIGHUP", () => process.exit(0) );

process.on( "exit", () =>
{
	console.log( "Process exiting" );
	botCore.shutdown();
});

process.on( "uncaughtException", err =>
{
	console.error( `Unhandled error: "${err}"` );
	process.exit(1);
});