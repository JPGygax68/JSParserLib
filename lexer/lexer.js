define( function() {

	//--- Token class ---------------------------------------------------------
	
	/** Constructor.
	 */
	function Token(type, text) {
		this.type = type;
		this.text = text;
	}
	
	Token.prototype.is = function(type, text) {
		return this.type == type && (text === undefined || this.text === text);
	}
	
	//--- Lexer class ---------------------------------------------------------
	
	function Lexer(reader, globbers /*, parser_fun, parser_obj*/) {
		this.reader = reader;
		this.globbers = globbers;
		/* this.parser_fun = parser_fun;
		this.parser_obj = parser_obj; */
	}

	/**	Uses the "globber" functions to parse tokens from the character
	 *  stream obtained through the Reader.
	 *  Returns a token object (composed of token_type and text) if one of
	 *  the globbers successfully recognized a token; false otherwise.
	 */
	Lexer.prototype.readNextToken = function() {
		for (var i = 0; i < this.globbers.length; i ++) {
			this.reader.savePos();
			var globber = this.globbers[i].globber;
			var type = this.globbers[i].token_type;
			var text = globber(this.reader);
			if (text) return new Token(type, text);
			this.reader.restorePos();
		}
		return false;
	}
	
	/**	- Uses the "globber" functions to parse tokens from the character
	 *    stream obtained through the Reader.
	 *  - Calls the parser_fun callback function (setting "this" to the
	 *    specified parser object) when a token was recognized.
	 */
	/*
	Lexer.prototype.getNextToken = function() {
		console.log('WARNING: deprecated method Lexer.getNextToken() called');
		for (var i = 0; i < this.globbers.length; i ++) {
			this.reader.savePos();
			var globber = this.globbers[i].globber;
			var token_type = this.globbers[i].token_type;
			var token = globber(this.reader);
			if (token) {
				this.reader.dropLastMark();
				this.parser_fun.call(this.parser_obj, token_type, token, this.reader);
				return true;
			}
			this.reader.restorePos();
		}
		return false;
	}
	*/
	
	//--- PUBLIC API ----------------------------------------------------------
	
	return {
		/** Creates a Lexer object. */
		create: function(reader, globbers /*, parser_fun, parser_obj*/) { 
			return new Lexer(reader, globbers /*, parser_fun, parser_obj*/); }
	}
});