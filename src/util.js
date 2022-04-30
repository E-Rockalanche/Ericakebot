// random util

function randomInt( maxValue )
{
	return Math.floor( Math.random() * maxValue );
}

function randomIntRange( minValue, maxValue )
{
	return minValue + randomInt( maxValue - minValue + 1 );
}

function randomChance( probablity )
{
	return Math.random() < probablity;
}

// array util

function arrayBack( arr )
{
	return arr[ arr.length - 1 ];
}

function arrayErase( arr, value )
{
	const index = arr.indexOf( value );
	if ( index  != -1 )
		arr.splice( index, 1 );
}

function arrayBackSwapErase( arr, value )
{
	const index = arr.indexOf( value );
	if ( index != -1 )
		arrayBackSwapEraseAt( index );
}

function arrayBackSwapEraseAt( arr, index )
{
	arr[ index ] = arrayBack( arr );
	arr.pop();
}

function arrayContains( arr, value )
{
	return arr.indexOf( value ) != -1;
}

function arrayPushUnique( arr, value )
{
	if ( !arrayContains( arr, value ) )
		arr.push( value );
}

function arrayRandom( arr )
{
	return arr[ randomInt( arr.length ) ];
}

function arrayResize( arr, newSize, value = undefined )
{
	const oldSize = arr.length;
	arr.length = newSize;
	if ( newSize > oldSize )
		arr.fill( value, oldSize );
}

// string util

const stricmpCollator = new Intl.Collator( undefined, { sensitivity: "base"} );

function stricmp( lhs, rhs )
{
	return stricmpCollator.compare( lhs, rhs );
}

function strieq( lhs, rhs )
{
	return stricmp( lhs, rhs ) == 0;
}

module.exports = {
	randomInt,
	randomIntRange,
	randomChance,

	arrayBack,
	arrayErase,
	arrayBackSwapErase,
	arrayBackSwapEraseAt,
	arrayContains,
	arrayPushUnique,
	arrayRandom,
	arrayResize,

	stricmp,
	strieq
};