define( function() {

    function Element(rule, content) {
        this.rule = rule;
        this.content = content;
    }
    
    Element.prototype.getText = function() {
        if (this.content instanceof Element) {
            return this.content.getText();
        }
        else return this.content;
    }
    
    Element.prototype.getType = function() {
        if (typeof this.content === 'string') return this.rule.rule_name;
        else return this.content.getType();
    }
    
    Element.prototype.getSubTypes = function() {
        var types = [];
        for (var elem = this.content; elem instanceof Element; elem = elem.content) types.push( elem.rule.rule_name );
        return types;
    }
    
	//--- Building blocks -----------------------------------------------------
	
    /*  The building block functions are called as internal methods of Rule 
     *  objects (while the Rules themselves are function objects).
     */
     
	function _singleChar(reader, pred) {
		var c = reader.peekNextChar();
		if (pred(c)) { reader.consumeNextChar(); return new Element(this, c); }
		return false;
	}
    
    /** Consume conforming characters greedily as long as the element conforms.
     */
    function _string(reader, char_pred, elem_pred) {
        var text = '';
        while (!char_pred || char_pred(reader.peekNextChar())) {
            var text2 = text + reader.peekNextChar();
            if (elem_pred && !elem_pred(text2)) break;
            reader.consumeNextChar();
            text = text2;
        }
        return text.length > 0 ? new Element(this, text) : false;
    }
    
	function _anyOf(reader, sub_rules) {
		for (var i = 0; i < sub_rules.length; i ++) {
			var sub_elem = sub_rules[i].call(sub_rules[i], reader);
			if (sub_elem !== false) return new Element(this, sub_elem);
		}
		return false;
	}
    
    /** Not used at the moment.
     */
    function _anyOf__greedy(reader, sub_rules) {
        var result = false;
        var end_pos;
        for (var i = 0; i < sub_rules.length; i ++) {
            reader.savePos();
            var sub_elem = sub_rules[i].call(sub_rules[i], reader);
            if (sub_elem !== false) {
                // TODO: better way to compare match "quality" ?
                if (result === false || sub_elem.getText().length > result.getText().length) {
                    result = new Element(this, text);
                    end_pos = reader.getCurrentPos();
                }
            }
            reader.restorePos();
        }
        if (result !== false) reader.goToPos(end_pos);
        return result;
    }

    function _lookAhead(reader, sub_rule) {
        reader.savePos();
        var sub_elem = sub_rule.call(sub_rule, reader);
        reader.restorePos();
        return sub_elem !== false ? new Element(this, sub_elem) : false;
    }

    /** Rejects the element if it can be parsed as the first rule but also as the
     *  second one.
     */
    function _butNot(reader, sub_rule, neg_rule) {
        reader.savePos();
        var sub_elem = sub_rule.call(sub_rule, reader);
        var end_pos = reader.getCurrentPos();
        reader.restorePos();
        if (sub_elem === false) return false;
        reader.savePos();
        var neg_elem = neg_rule.call(neg_rule, reader);
        reader.restorePos();
        if ((neg_elem !== false) && (neg_elem.getText() === sub_elem.getText()) ) return false;
        reader.goToPos(end_pos);
        return new Element(this, sub_elem);
    }
    
    /** This implements a 0..n times _repetition.
     */
	function _repetition(reader, sub_rule) {
		var text = '';
		while (true) {
			var sub_elem = sub_rule.call(sub_rule, reader);
			if (sub_elem === false) return new Element(this, text);
			text += sub_elem.getText();
		}
        throw 'Parser._repetition(): must not arrive at end!';
	}
	
    function _optional(reader, sub_rule) {
        var sub_elem = sub_rule.call(sub_rule, reader);
        if (sub_elem === false) return new Element(this, "");
        else return new Element(this, sub_elem);
    }
    
	function _sequence(reader, sub_rules) {
		reader.savePos();
		var text = '';
		for (var i = 0; i < sub_rules.length; i ++) {
			var sub_elem = sub_rules[i].call(sub_rules[i], reader);
			if (sub_elem === false) { reader.restorePos(); return false; }
			text += sub_elem.getText();
		}
		reader.dropLastMark();
		return new Element(this, text);
	}
	
    function _filter(reader, sub_rule, pred) {
        reader.savePos();
        var sub_elem = sub_rule.call(sub_rule, reader);
        if ((sub_elem === false) || (!pred(sub_elem.getText()))) { 
            reader.restorePos(); return false; }
        reader.dropLastMark(); 
        return new Element(this, sub_elem);
    }
    
    //--- Parser class --------------------------------------------------------
    
    function Parser(reader, root_rule) {
        //this.reader = reader;
        //this.grammar = grammar;
        
        //var that = this;
        
        this.getNextElement = function() {
            return root_rule.call(root_rule, reader);
        }
    }
    
    //--- Helper functions ----------------------------------------------------

    function invertPredicate(pred) {
        return function(s) { return ! pred(s); }
    }
    
    function singleCharPredicate(pred) {
        if (pred === undefined || pred === '') {
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
        return (invert ? invertPredicate(real_pred) : real_pred);
    }

    /** Attach options to a rule (which is a function object).
     *  Every rule is a function object.
     */
    function finalizeRule(rule, options) {
        if (options !== undefined) {
            for (var key in options) {
                if (key in rule) throw "invalid rule option name (reserved): " + key;
                rule[key] = options[key];
            }
        }
        return rule;
    }
    
    function makeButNotCharRule(pos_pred, neg_pred, options) {
        var pos_pred = singleCharPredicate(pos_pred);
        var neg_pred = singleCharPredicate(neg_pred);
        var full_pred = function(c) { return pos_pred(c) && (!neg_pred(c)); };
        var options = options || { char_predicate: full_pred };
        return finalizeRule( function(reader) { return _singleChar.call(this, reader, full_pred); }, options );
    }
    
    /** Generates a rule that will consume a single character if it's among those
     *  contained in "chars".
     */
    function makeAnyCharRule(chars, invert, options) {
        var pred = singleCharPredicate(chars, invert);
        if (invert) pred = invertPredicate(pred);
        var options = options || { char_predicate: pred };
        return finalizeRule( function(reader) { return _singleChar.call(this, reader, pred); }, options );
    }
    
    function isSingleCharRule(rule) {
        return typeof(rule) === 'string' || rule.char_predicate;
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
        aChar: function(pred, options) {
            if (pred === undefined || typeof pred === 'string' || pred instanceof Function)
                return makeAnyCharRule(pred, false, options)
            else
                throw "Parser: aChar() called with non-supported predicate type";
        },
        
        /** This is the opposite of aChar(): it generates a rule consuming
         *  any character *not* in "chars".
         */
        noneOf: function(chars, options) { 
            if (typeof chars === 'string')
                return makeAnyCharRule(chars, true, options);
            else
                throw 'Parser: noneOf() called with non-supported "chars" argument';
        },
        
        /** Similar to noneOf(), but for a single character.
         */
        not: function(char_, options) {
            if (typeof char_ === 'string' && char_.length === 1)
                return makeAnyCharRule(char_, true, options)
            else
                throw 'Parser: not() called with non-supported "char_" argument: ' + char_;
        },

        /** Generates a rule that is an OR combination of the specified list of
         *  rules.
         *  If the "rules" parameter consists of a string, the generated rule
         *  will consume any single character contained in that string (in which
         *  case aChar() could be used interchangeably).
         */
        anyOf: function(sub_rules, options) {
            if (typeof sub_rules === 'string')
                return makeAnyCharRule(sub_rules, options)
            else if (sub_rules instanceof Array) {
                return finalizeRule( function(reader) { return _anyOf.call(this, reader, sub_rules); }, options )
            }
            else
                throw 'Parser: anyOf() called with non-supported "sub_rules" argument';
        },

        /** lookAhead() generates a rule that will never consume anything.
         *  Instead, it will check if the specified rule *could* match, then
         *  backtracks and returns either:
         *  - an empty string that means that the rule *would* match, or
         *  - the value *false*, meaning that the rule would *not* match.
         */
        lookAhead: function(sub_rule, options) {
            return finalizeRule( function(reader) { return _lookAhead.call(this, reader, sub_rule); }, options );
        },
        
        /** Generates a rule that will consume an element if it conforms to
         *  the first specified rule but could *not* also be consumed by the
         *  second rule.
         */
        butNot: function(sub_rule, neg_rule, options) {
            // Are both rules single-char rules ?
            if (isSingleCharRule(sub_rule) && isSingleCharRule(neg_rule)) {
                return makeButNotCharRule(sub_rule.char_predicate, neg_rule.char_predicate, options)
            }
            else 
                return finalizeRule( function(reader) { return _butNot.call(this, reader, sub_rule, neg_rule); }, options );
        },
        
        /** As the name says, generates a rule that consumes an element conforming
         *  to all the specified sub-rules taken in sequence.
         */
        sequence: function(sub_rules, options) {
            if (typeof sub_rules === 'string') {
                var real_subrules = sub_rules.split('').map( function(c) { return makeAnyCharRule(c); } );
                return finalizeRule( function(reader) { return _sequence.call(this, reader, real_subrules); }, options );
            }
            else if (sub_rules instanceof Array) {
                // TODO: support converting array members
                return finalizeRule( function(reader) { return _sequence.call(this, reader, sub_rules); }, options );
            }
            else throw 'Parser.sequence(): unsupported type for argument "sub_rules"';
        },
        
        /** Generates a rule consuming as many conforming elements as possible
         *  (i.e. "greedily").
         */
        repetition: function(sub_rule, options) {
            return finalizeRule( function(reader) { return _repetition.call(this, reader, sub_rule); }, options );
        },
        
        /** Generates an optional version of the specified rule.
         */
        optional: function(sub_rule, options) {
            return finalizeRule( function(reader) { return _optional.call(this, reader, sub_rule); }, options );
        },
        
        /** Generates a predicate-filtered version of the specified rule.
         *  The meaning of the predicate can be inverted by setting "inv" to true.
         *  The predicate can be replaced by a simple string, against which the
         *  the product of the rule would then be compared.
         */
        filter: function(sub_rule, pred, inv, options) {
            pred = convertPredicate(pred, inv);
            return finalizeRule( function(reader) { return _filter.call(this, reader, sub_rule, pred); }, options );
        },
        
        /** Generates a rule that consumes characters conforming to the specified
         *  character predicate (or if char_pred is a string, characters contained
         *  in that string) as long as the element conforms to the element 
         *  predicate elem_pred.
         *  This is intended for special cases, like the operators in a C-like
         *  language, and especially those in JavaScript, where operators can have up
         *  to 3 characters coming from a relatively small set.
         */
        string: function(char_pred, elem_pred, options) {
            char_pred = singleCharPredicate(char_pred);
            elem_pred = convertPredicate(elem_pred);
            return finalizeRule( function(reader) { return _string.call(this, reader, char_pred, elem_pred); }, options );
        },
        
        finalizeGrammar: function(g) {
            for (var name in g) {
                g[name].rule_name = name;
            }
            return g;
        }
	}
});