"use strict"

// add variables from file ".env" to process.env
require("dotenv").config();

const options = require("./CommandLineArgs.js").parse( process.argv );
console.log( options );

const readline = require("readline");

const BotCore = require("./botcore.js");
const CopypastaGenerator = require("./CopypastaGenerator.js");
const PyramidStopper = require("./PyramidStopper.js");

// INITIALIZE

const botCore = new BotCore( process.env.BOT_USERNAME, process.env.BOT_OAUTH, options.channel );

const copypastaGenerator = new CopypastaGenerator( botCore, { keyLength: 2, minTokenLength: 2, maxMessageLength: 256 } );

if ( options.corpus )
	copypastaGenerator.loadCorpus( options.corpus );

const pyramidStopper = new PyramidStopper( botCore );

// RUN

botCore.connect();

const cli = readline.createInterface( process.stdin, process.stdout );

cli.on("line", (text) =>
{
	botCore.emit("commandline", text);
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

process.on( "uncaughtException", (err) =>
{
	console.error( `Unhandled error: "${err}"` );
	process.exit(1);
});