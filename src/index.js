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

// INITIALIZE

const botCore = new BotCore( process.env.BOT_USERNAME, process.env.BOT_OAUTH, options );

const copypastaGeneratorOptions = {
	keyLength: 3,
	minTokenLength: 2,
	maxMessageLength: 256,
	weightFunction: x => Math.round( Math.sqrt( x ) )
};
const copypastaGenerator = new CopypastaGenerator( botCore, copypastaGeneratorOptions );

if ( options.corpus )
	copypastaGenerator.loadCorpus( options.corpus );

const pyramidStopper = new PyramidStopper( botCore );

const chantComponent = new ChantComponent( botCore );

// RUN

botCore.connect();

const cli = readline.createInterface( process.stdin, process.stdout );

cli.on("line", str =>
{
	botCore.parseCommand( str );
});

process.on( "exit", () =>
{
	console.log( "Process exiting" );
	botCore.shutdown();
});

process.on( "SIGTERM", () =>
{
	process.exit(0);
});

process.on( "SIGINT", () =>
{
	process.exit(0);
});

process.on( "uncaughtException", err =>
{
	console.error( `Unhandled error: "${err}"` );
	process.exit(1);
});