class ReminderComponent
{
	constructor( botCore )
	{
		this.core = botCore;

		this.core.commands.registerCommand( "!remindme", "all", this.createReminder.bind( this ) );
	}

	createReminder( channel, userstate, args )
	{
		if ( !this.tryCreateReminder( channel, userstate, args ) )
		{
			this.core.say( channel, `Command arguments are: !reminder <number><ms|s|m|h|d> <message>` );
		}
	}

	tryCreateReminder( channel, userstate, args )
	{
		if ( args.length < 2 )
			return false;

		const timeStr = args[0];
		const result = timeStr.match( /^(\d*\.?\d+)(ms|s|m|h|d)$/ );

		if ( result.length < 3 )
			return false;

		const numberStr = result[1];
		const unit = result[2];

		let unitMS = 0;
		switch( unit )
		{
			case "ms": unitMS = 1; break;
			case "s": unitMS = 1000; break;
			case "m": unitMS = 1000 * 60; break;
			case "h": unitMS = 1000 * 60 * 60; break;
			case "d": unitMS = 1000 * 60 * 60 * 24; break;
			default: return false;
		}

		const milliseconds = parseFloat( numberStr ) * unitMS;
		args.shift();
		const message = args.join(" ");

		setTimeout( () => {
			this.core.say( channel, `@${userstate.username} Reminder! "${message}"` );
		}, milliseconds );

		this.core.say( channel, `Set reminder for "${message}" in ${timeStr}` );

		return true;
	}
};

module.exports = ReminderComponent;