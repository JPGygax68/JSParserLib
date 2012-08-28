define( function() {

    /** TODO: is it a good idea that rules are functions ?
        -   It makes it more difficult to optimize them (anyOf), and the actual rule function may
            never be executed (though these functions are very small closures).
        -   If using objects instead of functions, inheritance may become useful.
     */
    
    //--- Element: returned by parsing rules ----------------------------------
    
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
    
	//--- Parser building blocks ----------------------------------------------
	
    /*  The building block functions are called as internal methods of Rule 
     *  objects (while the Rules themselves are function objects).
     */
     
	function _singleChar(reader, pred) {
		var c = reader.currentElement();
		if (pred(c)) { reader.consumeCurrentElement(); return new Element(this, c); }
		return false;
	}
    
    /** Consume conforming characters greedily as long as the element conforms.
     */
    function _string(reader, char_pred, elem_pred) {
        var text = '';
        while ((!char_pred) || char_pred(reader.currentElement())) {
            var text2 = text + reader.currentElement();
            if (elem_pred && (!elem_pred(text2))) break;
            reader.consumeCurrentElement();
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
    
    function _lookAhead(reader, pred) {
        return pred(reader.currentElement()) ? new Element(this, reader.currentElement()) : false;
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
    
    function singleCharPredicate(pred, invert) {
        if (pred === undefined || pred === '') {
            pred = function(c) { return true; }
        }
        else if (typeof pred === 'string') {
            var s = pred;
            if (pred.length === 0) {
                pred = function(c) { return true; }
            }
            else if (pred.length === 1) {
                pred = function(c) { return c === s; };
            }
            else {
                pred = function(c) { return s.indexOf(c) >= 0; }
            }
        }
        if (invert) pred = invertPredicate(pred);
        return pred;
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
        rule.isRule = true;
        return rule;
    }
    
    /** Creates a single-char rule that combines a positive and a negative predicate.
     */
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
        var pred = singleCharPredicate(chars, invert, invert);
        var options = options || { char_predicate: pred };
        return finalizeRule( function(reader) { return _singleChar.call(this, reader, pred); }, options );
    }
    
    function isSingleCharRule(rule) {
        return typeof(rule) === 'string' || (rule.isRule && rule.char_predicate);
    }
    
    function allSingleCharRules(rules) { return rules.every( isSingleCharRule ); }
    
    function mergeSingleCharRules(sub_rules, options) {
        //console.log('all single char rules!');
        var rule = function(reader) {
            var c = reader.currentElement();
            for (var i = 0; i < sub_rules.length; i ++) {
                if (sub_rules[i].char_predicate(c)) {
                    reader.consumeCurrentElement();
                    return new Element(sub_rules[i], c);
                }
            }
            return false;
        };
        return finalizeRule( rule, options );
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
                // TODO: optimize by merging single-char rules
                if (allSingleCharRules(sub_rules))
                    return mergeSingleCharRules(sub_rules, options);
                else {
                    var real_subrules = sub_rules.map( function(sr) { return sr.isRule ? sr : makeAnyCharRule(sr); } );
                    return finalizeRule( function(reader) { return _anyOf.call(this, reader, real_subrules); }, options )
                }
            }
            else
                throw 'Parser: anyOf() called with non-supported "sub_rules" argument';
        },

        /** lookAhead() generates a rule that will never consume anything.
         *  Instead, it simply checks whether or not the specified predicate *would* match
         *  the *next* pending character of the input stream. The rule can return:
         *  - an empty string that means that the predicate *would* match, or
         *  - the value *false*, meaning that the predicate would *not* match.
         */
        lookAhead: function(pred, options) {
            pred = singleCharPredicate(pred);
            return finalizeRule( function(reader) { return _lookAhead.call(this, reader, pred); }, options );
        },
        
        /** Generates a rule that will consume an element if it conforms to
         *  the first specified rule but could *not* also be consumed by the
         *  second rule.
         *  TODO: replace neg_rule with neg_pred (predicates instead of full-blown rules)?
         */
        butNot: function(sub_rule, neg_rule, options) {
            // Are both rules single-char rules ?
            if (isSingleCharRule(sub_rule) && isSingleCharRule(neg_rule)) {
                return makeButNotCharRule(sub_rule.char_predicate, neg_rule.char_predicate, options)
            }
            else throw 'Parser.butNot(): unsupported argument types';
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
        
        //--- Miscellaneous ---------------------------------------------------
        
        /** Inverts a predicate.
         */
        not: function(pred) {
            if (typeof pred === 'string' && pred.length === 1)
                return singleCharPredicate(pred, true); //makeAnyCharRule(pred, true, options)
            else if (typeof pred === 'function' && pred.rule_name === undefined)
                return invertPredicate(pred);
            else
                throw 'Parser: not() called with non-supported "char_" argument: ' + char_;
        },

        finalizeGrammar: function(g) {
            for (var name in g) {
                g[name].rule_name = name;
            }
            return g;
        }
	}
});