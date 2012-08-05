define( function() {

	//--- Token class ---------------------------------------------------------
	
	/** Constructor.
	 */
	function Token(type, text) {
		this.type = type;
		this.text = text;
        console.log(type + ': ' + text.trim());
	}
	
	Token.prototype.is = function(type, text) {
		return this.type == type && (text === undefined || this.text === text);
	}
	
	//--- Lexer building blocks -----------------------------------------------
	
	function _singleChar(reader, pred) {
		var c = reader.peekNextChar();
		if (pred(c)) { reader.consumeNextChar(); return c; }
		return false;
	}
    
    /** Consume conforming characters greedily as long as the element conforms.
     */
    function _greedy(reader, char_pred, elem_pred) {
        reader.savePos();
        var text = '';
        //console.log('_greedy: c = ' + reader.peekNextChar());
        while (char_pred(reader.peekNextChar())) {
            var text2 = text + reader.peekNextChar();
            if (!elem_pred(text2)) break;
            reader.consumeNextChar();
            text = text2;
        }
        reader.dropLastMark();
        return text;
    }
    
    /** Not used at the moment.
     */
	function _anyOf_non_greedy(reader, terms) {
		for (var i = 0; i < terms.length; i ++) {
			var term = terms[i];
			var text = term(reader);
			if (text !== false) return text;
		}
		return false;
	}
    
    function _anyOf(reader, terms) {
        var result = false;
        var end_pos;
        for (var i = 0; i < terms.length; i ++) {
            var term = terms[i];
            reader.savePos();
            var text = term(reader);
            if (text !== false) {
                if ((!result) || (text.length > result.length)) {
                    result = text;
                    end_pos = reader.getCurrentPos();
                }
            }
            reader.restorePos();
        }
        if (result !== false) {
            reader.goToPos(end_pos);
            return result;
        }
        return false;
    }

    /** Rejects the element if it can be parsed as the first term but also as the
     *  second one.
     */
    function _butNot(reader, term, neg_term) {
        reader.savePos();
        var res = term(reader);
        var end_pos = reader.getCurrentPos();
        reader.restorePos();
        if (res === false) return false;
        reader.savePos();
        var res2 = neg_term(reader);
        reader.restorePos();
        if (res2 !== false && res2 === res) return false;
        reader.goToPos(end_pos);
        return res;
    }
    
    /** This implements a 0..n times _repetition.
     */
	function _repetition(reader, term) {
		var text = '';
		while (true) {
			var part = term(reader);
			if (part === false) return text;
			text += part;
		}
        alert('_repetition(): must not arrive at end!');
	}
	
    function _optional(reader, term) {
        var part = term(reader);
        if (part === false) return "";
        else return part;
    }
    
	function _sequence(reader, terms) {
		reader.savePos();
		var text = '';
		for (var i = 0; i < terms.length; i ++) {
			var term = terms[i];
			var part = term(reader);
			if (part === false) { reader.restorePos(); return false; }
			text += part;
		}
		reader.dropLastMark();
		return text;
	}
	
    function _filter(reader, term, pred) {
        reader.savePos();
        var text = term(reader);
        if (text === false || !pred(text)) { reader.restorePos(); return false; }
        reader.dropLastMark(); 
        return text;
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
	Lexer.prototype.readNextElement = function() {
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

    //--- Helper functions ----------------------------------------------------

    function invertPred(pred) {
        return function(s) { return ! pred(s); }
    }
    
    function singleCharPredicate(pred, invert) {
        var real_pred;
        if (typeof pred === 'string') {
            var s = pred;
            if (pred.length === 1) {
                real_pred = function(c) { return c === s; };
            }
            else {
                real_pred = function(c) { return s.indexOf(c) >= 0; }
            }
        }
        else {
            real_pred = pred;
        }
        return invert ? invertedPred(real_pred) : real_pred;
    }

    function stringPredicate(pred, invert) {
        var real_pred;
        if (typeof pred === 'string') {
            real_pred = function(text) { return text === pred; };
        }
        else if (pred instanceof Array) {
            var a = pred;
            for (var i = 0; i < a.length; i ++) a[i] = stringPredicate(a[i]);
            real_pred = function(s) {
                for (var i = 0; i < a.length; i ++) if (a[i](s)) return true;
                return false; }
        }
        else {
            real_pred = pred;
        }
        return (invert ? invertedPred(real_pred) : real_pred);
    }

	//--- PUBLIC API ----------------------------------------------------------
	
	return {
		/** Creates a Lexer object. */
		create: function(reader, globbers /*, parser_fun, parser_obj*/) { 
			return new Lexer(reader, globbers /*, parser_fun, parser_obj*/); 
        },
            
        //--- Term factories --------------------------------------------------
        
        singleChar: function(pred) {
            pred = singleCharPredicate(pred);
            return function(reader) { return _singleChar(reader, pred); }
        },
        anyOf: function(terms) {
            return function(reader) { return _anyOf(reader, terms); }
        },
        butNot: function(term, neg_term) {
            return function(reader) { return _butNot(reader, term, neg_term); }
        },
        sequence: function(terms) {
            return function(reader) { return _sequence(reader, terms); }
        },
        repetition: function(term) {
            return function(reader) { return _repetition(reader, term); }
        },
        optional: function(term) {
            return function(reader) { return _optional(reader, term); }
        },
        filter: function(term, pred, inv) {
            pred = stringPredicate(pred, inv);
            return function(reader) { return _filter(reader, term, pred); }
        },
        greedy: function(char_pred, elem_pred) {
            char_pred = singleCharPredicate(char_pred);
            elem_pred = stringPredicate(elem_pred);
            return function(reader) { return _greedy(reader, char_pred, elem_pred); }
        }
	}
});