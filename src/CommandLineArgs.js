
function parse( args )
{
	const options = {
		getInt: name => Number.parseInt( this[ name ] ),
		getFloat: name => Number.parseFloat( this[ name ] ),
		getBool: name => this[ name ] === 'true'
	};

	let lastArgName = "";

	for( let i = 0; i < args.length; ++i )
	{
		let arg = args[i];

		if ( arg[0] == "-" )
		{
			// add previous argument
			if ( lastArgName != "" )
			{
				options[ lastArgName ] = "true";
			}

			// remove dashes from front
			while( arg.length > 0 && arg[0] == "-" )
				arg = arg.slice( 1 );

			if ( arg.length > 0 )
			{
				// start new argument
				lastArgName = arg;
			}
		}
		else
		{
			options[ lastArgName ] = arg;
		}
	}

	return options;
}

module.exports = {
	parse
};