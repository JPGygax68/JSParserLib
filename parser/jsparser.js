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
			var token;
			while ((token = this.lexer.readNextToken()) !== false) {
                //console.log(token.type + ' ' + token.text);
            }
		}
		finally {
			if (ok) this.reader.dropLastMark(); else this.reader.restorePos();
		}
	}
	
	return {
		create: function(reader) { return new Parser(reader); }
	}
	
}); // END define()
