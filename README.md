# Ericakebot
Twitch chat bot written in javascript

## How to install
* clone or copy the repository
* download and install Node.js
* open a command prompt in the root folder
* run "npm install"

## How to run
* add a text file named ".env" to the root folder with the following lines:
    * "BOT_USERNAME=twitch bot channel name"
    * "BOT_OAUTH=twitch bot channel oauth token"
* open a command prompt in the root folder
* run "node src -channel <CHANNEL_NAME>"

| Parameter | Optional | Description |
| --- | --- | --- |
| -channel | no | twitch channel to connect to |
| -corpus | yes | text file of messages to automatically add to copypasta generator |
| -superadmin | yes | user with permission to execute commands in twitch chat |

Example: "node src -channel ericake -corpus ./corpus/copypastas.txt"
