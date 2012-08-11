define( function() {

    function Element(rule, content) {
        this.rule = rule;
        this.content = content;
    }
    
    Element.prototype.toString = function() {
        if (this.content instanceof Element) return this.content.toString();
    }
    
	//--- Building blocks -----------------------------------------------------
	
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
        while (char_pred(reader.peekNextChar())) {
            var text2 = text + reader.peekNextChar();
            if (!elem_pred(text2)) break;
            reader.consumeNextChar();
            text = text2;
        }
        reader.dropLastMark();
        return text.length > 0 ? text : false;
    }
    
	function _anyOf(reader, rules) {
		for (var i = 0; i < rules.length; i ++) {
			var text = rules[i](reader);
			if (text !== false) return text;
		}
		return false;
	}
    
    /** Not used at the moment.
     */
    function _anyOf__greedy(reader, rules) {
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

    function _lookAhead(reader, rule) {
        reader.savePos();
        var text = rule(reader);
        reader.restorePos();
        return text;
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
        throw '_repetition(): must not arrive at end!';
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
			var part = rules[i](reader);
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
    
    //--- Parser class --------------------------------------------------------
    
    function Parser(reader, root_rule) {
        //this.reader = reader;
        //this.grammar = grammar;
        
        //var that = this;
        
        this.readNextElement = function() {
            return root_rule(reader);
        }
    }
    
    Parser.prototype.parse = function() {
        var elem;
        var i = 0;
        console.log('Starting to parse...');
        while ((elem = this.readNextElement()) !== false) {
            //console.log('Element #'+i+': ', elem.trim() );
            i += 1;
            if (i > 100000) throw "forced stop";
        }
        console.log(i + ' elements read.');
    }
    
    //--- Helper functions ----------------------------------------------------

    function invertPredicate(pred) {
        return function(s) { return ! pred(s); }
    }
    
    function singleCharPredicate(pred) {
        if (pred === undefined) {
            return function(c) { return true; }
        }
        else if (typeof pred === 'string') {
            var s = pred;
            if (pred.length === 0) {
                return function(c) { return true; }
            }
            else if (pred.length === 1) {
                return function(c) { return c === s; };
            }
            else {
                return function(c) { return s.indexOf(c) >= 0; }
            }
        }
        else {
            return pred;
        }
    }

    function arrayPredicate(pred, invert) {
        var a = pred;
        for (var i = 0; i < a.length; i ++) a[i] = convertPredicate(a[i]);
        return function(s) {
            for (var i = 0; i < a.length; i ++) if (a[i](s)) return true;
            return false; }
    }
    
    function convertPredicate(pred, invert) {
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

    /** Generates a rule that will consume a single character if it's among those
     *  contained in "chars".
     */
    function makeAnyCharRule(chars, invert) {
        var pred = singleCharPredicate(chars, invert);
        if (invert) pred = invertPredicate(pred);
        var func = function(reader) { return _singleChar(reader, pred); };
        return func;
    }
    
	//--- PUBLIC API ----------------------------------------------------------
	
	return {
		/** Creates a Parser object. 
         */
		createParser: function(reader, root_rule) { 
			return new Parser(reader, root_rule);
        },
            
        //--- Rule factories --------------------------------------------------
        
        /** Generates a rule that will consume a single character conforming
         *  to the specified predicate.
         *  Instead of a predicate function, you can also specify a string,
         *  in which case the generated rule will consume any character
         *  contained in that string.
         */
        aChar: function(pred) {
            if (pred === undefined || typeof pred === 'string' || pred instanceof Function)
                return makeAnyCharRule(pred, false)
            else
                throw "Parser: aChar() called with non-supported predicate type";
        },
        
        /** This is the opposite of aChar(): it generates a rule consuming
         *  any character *not* in "chars".
         */
        noneOf: function(chars) { 
            if (typeof chars === 'string')
                return makeAnyCharRule(chars, true);
            else
                throw 'Parser: noneOf() called with non-supported "chars" argument';
        },
        
        /** Similar to noneOf(), but for a single character.
         */
        not: function(char_) {
            if (typeof char_ === 'string' && char_.length === 1)
                return makeAnyCharRule(char_, true)
            else
                throw 'Parser: not() called with non-supported "rules" argument: ' + char_;
        },

        /** Generates a rule that is an OR combination of the specified list of
         *  rules.
         *  If the "rules" parameter consists of a string, the generated rule
         *  will consume any single character contained in that string (in which
         *  case aChar() could be used interchangeably).
         */
        anyOf: function(rules) {
            if (typeof rules === 'string')
                return makeAnyCharRule(rules)
            else if (rules instanceof Array)
                return function(reader) { return _anyOf(reader, rules); }
            else
                throw 'Parser: anyOf() called with non-supported "rules" argument';
        },

        /** lookAhead() generates a rule that will never consume anything.
         *  Instead, it will check if the specified rule *could* match, then
         *  backtracks and returns either:
         *  - an empty string that means that the rule *would* match, or
         *  - the value *false*, meaning that the rule would *not* match.
         */
        lookAhead: function(rule) {
            return function(reader) { return _lookAhead(reader, rule); }
        },
        
        /** Generates a rule that will consume an element if it conforms to
         *  the first specified rule but could *not* also be consumed by the
         *  second rule.
         */
        butNot: function(rule, neg_rule) {
            return function(reader) { return _butNot(reader, rule, neg_rule); }
        },
        
        /** As the name says, generates a rule that consumes an element conforming
         *  to all the specified sub-rules taken in sequence.
         */
        sequence: function(rules) {
            if (typeof rules === 'string') {
                var real_rules = rules.split('').map( function(c) { return makeAnyCharRule(c); } );
                //console.log(real_rules);
                return function(reader) { return _sequence(reader, real_rules); }
            }
            else if (rules instanceof Array) {
                // TODO: support converting array members
                return function(reader) { return _sequence(reader, rules); }
            }
            else
                throw 'Lexer.sequence(): unsupported type for argument "rules"';
        },
        
        /** Generates a rule consuming as many conforming elements as possible
         *  (i.e. "greedily").
         */
        repetition: function(rule) {
            return function(reader) { return _repetition(reader, rule); }
        },
        
        /** Generates an optional version of the specified rule.
         */
        optional: function(rule) {
            return function(reader) { return _optional(reader, rule); }
        },
        
        /** Generates a predicate-filtered version of the specified rule.
         *  The meaning of the predicate can be inverted by setting "inv" to true.
         *  The predicate can be replaced by a simple string, against which the
         *  the product of the rule would then be compared.
         */
        filter: function(rule, pred, inv) {
            pred = convertPredicate(pred, inv);
            return function(reader) { return _filter(reader, rule, pred); }
        },
        
        /** Generates a rule that consumes characters conforming to the specified
         *  character predicate (or if char_pred is a string, characters contained
         *  in that string) as long as the element conforms to the element 
         *  predicate elem_pred.
         *  This is intended for special cases, like the operators in a C-like
         *  language, and especially those in JavaScript, where operators can have up
         *  to 3 characters coming from a relatively small set.
         */
        greedy: function(char_pred, elem_pred) {
            char_pred = singleCharPredicate(char_pred);
            elem_pred = convertPredicate(elem_pred);
            return function(reader) { return _greedy(reader, char_pred, elem_pred); }
        }
	}
});