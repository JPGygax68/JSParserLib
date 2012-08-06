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
	
    // TODO: lookahead predicate
    
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
	function _anyOf_non_greedy(reader, rules) {
		for (var i = 0; i < rules.length; i ++) {
			var text = rules[i](reader);
			if (text !== false) return text;
		}
		return false;
	}
    
    function _anyOf(reader, rules) {
        var result = false;
        var end_pos;
        for (var i = 0; i < rules.length; i ++) {
            reader.savePos();
            var text = rules[i](reader);
            if (text !== false) {
                if (result === false || text.length > result.length) {
                    result = text;
                    end_pos = reader.getCurrentPos();
                }
            }
            reader.restorePos();
        }
        if (result !== false) reader.goToPos(end_pos);
        return result;
    }

    function _noneOf(reader, rules) {
        var end_pos;
        for (var i = 0; i < rules.length; i ++) {
            var rule = rules[i];
            reader.savePos();
            var text = rule(reader);
            reader.restorePos();
            if (text !== false) return false; // "none of" has failed
        }
        return "";
    }

    /** Rejects the element if it can be parsed as the first rule but also as the
     *  second one.
     */
    function _butNot(reader, rule, neg_term) {
        reader.savePos();
        var res = rule(reader);
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
	function _repetition(reader, rule) {
		var text = '';
		while (true) {
			var part = rule(reader);
			if (part === false) return text;
			text += part;
		}
        alert('_repetition(): must not arrive at end!');
	}
	
    function _optional(reader, rule) {
        var part = rule(reader);
        if (part === false) return "";
        else return part;
    }
    
	function _sequence(reader, rules) {
		reader.savePos();
		var text = '';
		for (var i = 0; i < rules.length; i ++) {
			var rule = rules[i];
			var part = rule(reader);
			if (part === false) { reader.restorePos(); return false; }
			text += part;
		}
		reader.dropLastMark();
		return text;
	}
	
    function _filter(reader, rule, pred) {
        reader.savePos();
        var text = rule(reader);
        if (text === false || !pred(text)) { 
            reader.restorePos(); return false; }
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
        else
            real_pred = pred;
        return invert ? invertPred(real_pred) : real_pred;
    }

    function stringPredicate(pred, invert) {
        var real_pred;
        if (typeof pred === 'string') {
            real_pred = function(text) { return text === pred; };
        }
        else if (pred instanceof Array) {
            real_pred = arrayPredicate(pred, invert);
        }
        else {
            real_pred = pred;
        }
        return (invert ? invertedPred(real_pred) : real_pred);
    }

    function arrayPredicate(pred, invert) {
        var a = pred;
        for (var i = 0; i < a.length; i ++) a[i] = stringPredicate(a[i]);
        return function(s) {
            for (var i = 0; i < a.length; i ++) if (a[i](s)) return true;
            return false; }
    }
    
    function makeAnyCharRule(rule, invert) {
        var pred = singleCharPredicate(rule, invert);
        return function(reader) { return _singleChar(reader, pred); };
    }
    
    function makeAnyOfRule(rules, invert) {
        var pred;
        var rule;
        if (typeof rules === 'string') {
            pred = singleCharPredicate(rules);
            if (invert) pred = invertPred(pred);
            return function(reader) { return _singleChar(pred); }
        }
        else if (rules instanceof Array) {
            if (invert) return function(reader) { return _noneOf(reader, rules); }
            else return function(reader) { return _anyOf(reader, rules); }
        }
        else
            throw 'Parser INTERNAL ERROR: makeAnyOfRule() called with non-supported "rules" argument';
    }
    
	//--- PUBLIC API ----------------------------------------------------------
	
	return {
		/** Creates a Lexer object. */
		create: function(reader, globbers /*, parser_fun, parser_obj*/) { 
			return new Lexer(reader, globbers /*, parser_fun, parser_obj*/); 
        },
            
        //--- Rule factories --------------------------------------------------
        
        /** Generates a rule that is an OR combination of the specified list of
         *  rules.
         *  If the "rules" parameter consists of a string, the generated rule
         *  will consume any single character contained in that string.
         */
        anyOf: function(rules) {
            if (typeof rules === 'string')
                return makeAnyCharRule(rules, false)
            else if (rules instanceof Array)
                return makeAnyOfRule(rules, false);
            else
                throw 'Lexer.anyOf(): unsupported type for argument "rules"';
        },

        /** This is the opposite of anyOf().
         *  Note that a noneOf rule will never actually consume anything: in 
         *  case any of the specified rules (or characters, if the "rules" 
         *  argument is a string) *would* match, the rule will backtrack and 
         *  return the boolean value "false".
         *  (If none of the rules could match, the generated noneOf rule will 
         *  return an empty string. If you plan to use a noneOf rule directly,
         *  make sure you check the its result explicitly with the non-
         *  typecasting comparison operator !==)
         */
        noneOf: function(rules) {
            if (typeof rules === 'string')
                return makeAnyCharRule(rules, true)
            else if (rules instanceof Array)
                return makeAnyOfRule(rules, true);
            else
                throw 'Lexer.noneOf(): unsupported type for argument "rules"';
        },
        
        not: function(rules) {
            if (typeof rules === 'string')
                return makeAnyCharRule(rules, true)
            else if (rules instanceof Array)
                return makeAnyOfRule(rules, true)
            else
                return makeAnyOfRule([rules], true);
        },
        
        /** Generates a rule that will consume a single character conforming
         *  to the specified predicate.
         */
        aChar: function(pred) {
            if (typeof pred === 'string')
                return makeAnyCharRule(pred, false)
            else
                return function(reader) { return _singleChar(reader, pred); }
        },
        
        butNot: function(rule, neg_rule) {
            return function(reader) { return _butNot(reader, rule, neg_rule); }
        },
        
        sequence: function(rules) {
            if (typeof rules === 'string')
                return function(reader) { return _singleChar(reader, singleCharPredicate(rules)); }
            else if (rules instanceof Array)
                return function(reader) { return _sequence(reader, rules); }
            else
                throw 'Lexer.sequence(): unsupported type for argument "rules"';
        },
        
        repetition: function(rule) {
            return function(reader) { return _repetition(reader, rule); }
        },
        
        optional: function(rule) {
            return function(reader) { return _optional(reader, rule); }
        },
        
        filter: function(rule, pred, inv) {
            pred = stringPredicate(pred, inv);
            return function(reader) { return _filter(reader, rule, pred); }
        },
        
        greedy: function(char_pred, elem_pred) {
            char_pred = singleCharPredicate(char_pred);
            elem_pred = stringPredicate(elem_pred);
            return function(reader) { return _greedy(reader, char_pred, elem_pred); }
        }
	}
});