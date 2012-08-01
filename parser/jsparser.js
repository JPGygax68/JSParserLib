define(["../lexer/jslexer"], function(tokenizing) {

	/** Parser constructor.
	 */
	function Parser(reader) {
		this.reader = reader;
		this.lexer = tokenizing.createLexer(reader);
	}
	
	Parser.prototype.parse = function() {
		var ok = false;
		this.reader.savePos();
		try {
			var token = this.lexer.readNextToken();
			if (!token.is('keyword', 'var')) return false;
			if (!this.lexer.readNextToken().is('whitespace')) return false;
			var token = this.lexer.readNextToken();
			if (!token.is('identifier')) return false;
			console.log(token);
			//if (!token.is(
		}
		finally {
			if (ok) this.reader.dropLastMark(); else this.reader.restorePos();
		}
	}
	
	return {
		create: function(reader) { return new Parser(reader); }
	}
	
}); // END define()
