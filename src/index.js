"use strict"

// add variables from file ".env" to process.env
require("dotenv").config();

const options = require("./CommandLineArgs.js").parse( process.argv );

const BotCore = require("./botcore.js");
const CopypastaGenerator = require("./CopypastaGenerator.js");
const PyramidStopper = require("./PyramidStopper.js");

const botName = process.env.BOT_USERNAME;
const botAuth = process.env.BOT_OAUTH;
const channel = process.argv[2];

console.log( { botName, botAuth, channel } );

// initialize bot
const botCore = new BotCore( botName, botAuth, channel );

// add components
const copypastaGenerator = new CopypastaGenerator( botCore );
const pyramidStopper = new PyramidStopper( botCore );

// start
botCore.connect();