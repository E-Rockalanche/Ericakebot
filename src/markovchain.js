const util = require( "./util.js" );

class MarkovChain
{
	constructor()
	{
		this.matrix = new Map(); // sparse matrix of weights for row->column state transitions
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

	// returns entropy in terms of bits
	calculateStateEntropy( state )
	{
		const row = this.matrix.get( state );
		if ( row === undefined )
			return 0;

		return this.calculateRowEntropy( row );
	}

	// returns entropy in terms of bits
	calculateRowEntropy( row )
	{
		// H(X) = -SUM[i=1, n](P(x[i])*log2(P(x[i])))

		if ( row.totalWeight <= 0 )
			return 0; // state doesn't transition

		let entropy = 0;
		row.weights.forEach( weight =>
		{
			const probability = weight / row.totalWeight;
			entropy -= probability * Math.log2( probability );
		});
		return entropy;
	}

	// returns true if state has a deterministic transition
	stateHasZeroEntropy( state )
	{
		const row = this.matrix.get( state );
		return row === undefined || row.weights.size() <= 1;
	}
}

module.exports = MarkovChain;