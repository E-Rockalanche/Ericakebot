const util = require( "./util.js" );

class MarkovChain
{
	constructor( matrix = null )
	{
		// create sparse matrix of weights for row->column state transitions
		if ( matrix !== null )
			this.matrix = new Map( matrix );
		else
			this.matrix = new Map();
	}

	addTransition( from, to, weight = 1 )
	{
		let row = this.matrix.get( from );

		// create row if it doesn't exist
		if ( row === undefined )
		{
			row = { weights: new Map(), totalWeight: 0 };
			this.matrix.set( from, row );
		}

		// add weight to transition
		let currentWeight = row.weights.get( to );
		if ( currentWeight === undefined )
			row.weights.set( to, weight );
		else
			row.weights.set( to, currentWeight + weight );

		row.totalWeight += weight;
	}

	removeTransition( from, to, weight = 1 )
	{
		let row = this.matrix.get( from );
		if ( row === undefined )
		{
			console.error( `MarkovChain.removeTransition -- No row for '${from}'` );
			return;
		}

		let currentWeight = row.weights.get( to );
		if ( currentWeight === undefined )
		{
			console.error( `MarkovChain.removetransition -- No weight for transition '${from}'->'${to}'` );
			return;
		}
		
		currentWeight -= weight;
		row.totalWeight -= weight;
		
		if ( currentWeight < 0 )
			console.error( `MarkovChain.removetransition -- Weight for transition '${from}'->'${to}' is less than 0` );
		
		if ( row.totalWeight < 0 )
			console.error( `MarkovChain.removetransition -- Total weight for row '${from}' is less than 0` );
		
		if ( row.totalWeight <= 0 )
			this.matrix.delete( key );
		else if ( currentWeight <= 0 )
			row.weights.delete( value );
		else
			row.weights.set( to, currentWeight );
	}

	transitionFrom( from, useEqualWeights = false )
	{
		const row = this.matrix.get( from );
		if ( row === undefined )
		{
			console.error( `MarkovChain.getTransition -- No row for '${from}'` );
			return undefined;
		}

		if ( useEqualWeights )
		{
			let randomIndex = Math.floor( Math.random() * row.weights.size );
			let iterator = row.weights.keys();
			while( randomIndex > 0 )
			{
				--randomIndex;
				iterator.next();
			}
			let result = iterator.next();
			if ( result.value !== undefined )
				return result.value;
		}
		else
		{
			let randomWeight = Math.random() * row.totalWeight;
			for( const[ value, weight ] of row.weights )
			{
				if ( randomWeight < weight )
					return value;
				else
					randomWeight -= weight;
			}
		}

		console.error( `MarkovChain.getTransition(${from}, ${useEqualWeights}) -- Failed to find transition` );
		return undefined;
	}

	getTransitionWeight( from, to )
	{
		let row = this.matrix.get( from );
		if ( row === undefined )
			return 0;

		let weight = row.weights.get( to );
		if ( weight === undefined )
			return 0;

		return weight;
	}

	toJSON()
	{
		return Array.from( this.matrix.entries() );
	}
}

module.exports = MarkovChain;