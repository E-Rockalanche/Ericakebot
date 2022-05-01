"use strict"

// add variables from file ".env" to process.env
require("dotenv").config();

const options = require("./CommandLineArgs.js").parse( process.argv );
console.log( options );

const BotCore = require("./botcore.js");
const CopypastaGenerator = require("./CopypastaGenerator.js");
const PyramidStopper = require("./PyramidStopper.js");

const botName = process.env.BOT_USERNAME;
const botAuth = process.env.BOT_OAUTH;

// initialize bot
const botCore = new BotCore( botName, botAuth, options.channel );

// add components
const copypastaGenerator = new CopypastaGenerator( botCore, options );
const pyramidStopper = new PyramidStopper( botCore, options );

// start
botCore.connect();

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