const roles = [ "all", "sub", "vip", "mod", "broadcaster", "console" ];

class CommandRegistry
{
	constructor()
	{
		this.commands = new Map();
	}

	registerCommand( command, role, callback )
	{
		command = command.toLowerCase();
		role = role.toLowerCase();

		if ( typeof callback != 'function' )
		{
			console.error( `Command "${command}" callback is not a function` );
			return;
		}

		if ( roles.indexOf( role ) == -1 )
		{
			console.error( `Command "${command}" role "${role}" is unsupported` );
			return;
		}

		if ( this.commands.has( command ) )
		{
			console.error( `Command "${command}" is already registered` );
			return;
		}

		this.commands.set( command, { role, callback } );
		console.log( `Registered command "${command}"" with role "${role}"` );
	}

	removeCommand( command )
	{
		this.commands.delete( command );
	}

	setCommandRole( command, role )
	{
		const entry = this.commands.get( command );
		if ( entry )
			entry.role = role;
	}

	handleCommand( channel, userstate, message, checkRole = true )
	{
		const commandWordLength = message.search( /(\s+)|$/ );
		if ( commandWordLength == 0 )
			return;

		const command = message.substring( 0, commandWordLength ).toLowerCase();
		const entry = this.commands.get( command );
		if ( entry === undefined )
			return;

		if ( checkRole && !this.hasRole( userstate, entry.role ) )
		{
			console.log( `User ${userstate.username} requires role ${entry.role} for command ${command}` );
			return;
		}

		const args = message.trim().split(/\s+/);
		args.shift(); // remove command word

		entry.callback( channel, userstate, args );
	}

	hasRole( userstate, role )
	{
		switch( role )
		{
			case "all":
				return true;

			case "sub":
				if ( userstate.subscriber )
					return true;

			case "vip":
				if ( userstate.badges.vip )
					return true;

			case "mod":
				if ( userstate.mod )
					return true;

			case "broadcaster":
				if ( userstate.badges.broadcaster )
					return true;

			case "console":
			default:
				return false;
		}
	}
};

module.exports = CommandRegistry;