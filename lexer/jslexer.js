define(["./lexer", "./charclasses"], function(Lexer, CharClasses) {

    // TODO: comments!
	
	function isUnicodeLetter(c) {
		return (c >= 'A' && c <= 'Z')
			|| (c >= 'a' && c <= 'z');
			// TODO: actual support for Unicode!
	}
	
	function isUnicodeDigit(c) {
		return (c >= '0' && c <= '9');
	}
	
	function isIdentifierStart(c) {
		return isUnicodeLetter(c)
			|| (c === '$') || (c === '_');
	}
	
	function isIdentifierPart(c) {
		return isIdentifierStart(c)
			//|| isUnicodeCombininingMark(c) // TODO
			|| isUnicodeDigit(c)
			//|| isUnicodeConnectorPunctuation(c) // TODO
			//|| TODO: zero-width non-joiner, zero-width joiner
			;
	}

	function isReservedWord(text) {
        var WORDS = [
			'function', 'var', 'break', 'return', 'true', 'false', 'while', 'for', 'do', 'break', 'in', 'this',
			'new', 'try', 'catch', 'throw', 'finally'
		];
		return WORDS.indexOf(text) >= 0;
	}
	
	function genericGlobber(reader, start_pred, cont_pred) {
	
        var c = reader.peekNextChar();
		// Check starting predicate, abort if not met
        if (!c || !start_pred(c)) return false;
		// Continue while cont_pred is met
        var text = '';
        while (true) {
            text += reader.consumeNextChar();
            c = reader.peekNextChar();
            if (!c || !cont_pred(c)) break;
        }
        return text;
	}
	
	// TODO: replace according to real grammar
    function globKeyword(reader) {
        
		// STILL INCOMPLETE!
        var KEYWORDS = [
			'function', 'var', 'break', 'return', 'true', 'false', 'while', 'for', 'do', 'break', 'in', 'this',
			'new', 'try', 'catch', 'throw', 'finally'
		];

        var keyword = "";
        var c = reader.peekNextChar();
        if (!c || !CharClasses.isAlpha(c))
            return false;
        while (true) {
            keyword += reader.consumeNextChar();
            c = reader.peekNextChar();
            if (!c || !CharClasses.isAlnum(c)) break;
        }
        if (KEYWORDS.indexOf(keyword) >= 0) {
			//console.log('keyword = ' + keyword);
            return keyword;
        }
        else return false;
    }
    
    function globIdentifierName(reader) {
		return genericGlobber(reader, isIdentifierStart, isIdentifierPart);
    }
	
	function globIdentifier(reader) {
		var text = globIdentifierName(reader);
		if (text === false) return false;
		if (isReservedWord(text)) return false;
		return text;
	}
    
    function globNumericConstant(reader) {
        var c = reader.peekNextChar();
        if (!c || '0123456789'.indexOf(c) < 0)
            return false;
        var num = '';
        while (true) {
            num += reader.consumeNextChar();
            c = reader.peekNextChar();
            if (!c || '0123456789.'.indexOf(c) < 0) break;
            if (num.indexOf('.') >= 0 && c == '.') { return false; }
        }
        if (num === '.') return false;
        return num;
    }
    
    function globStringConstant(reader) {
        var c = reader.peekNextChar();
        if (!c || '\'"'.indexOf(c) < 0)
            return false;
        var s = reader.consumeNextChar();
        while ((c = reader.peekNextChar())) {
            if (c == '\'' && s[0] == '\'') {
                s += reader.consumeNextChar();
                break;
            }            
            else if (c == '"' && s[0] == '"') {
                s += reader.consumeNextChar();
                break;
            }            
            else if (c == '\\') {
                s += reader.consumeNextChar();
                s += reader.consumeNextChar();
            }
            else {
                s += reader.consumeNextChar();
            }
        }
        return s;
    }
    
    function globPunctuation(reader) {
        var c = reader.peekNextChar();
        if (!c || '[]{}();,'.indexOf(c) < 0)
            return false;
        reader.consumeNextChar();
        return c;
    }
    
    function globOperator(reader) {
        var c = reader.peekNextChar();
        var oper = '';
        while ('*+-/=^!<>.?:&|%~'.indexOf(c) >= 0) {
            oper += c;
            reader.consumeNextChar();
            c = reader.peekNextChar();
        }
        if (oper === '') return false;
        return oper;
    }
    
    function globWhitespace(reader) {
        var ws = "";
        while (true) {
            var c = reader.peekNextChar();
            if (' \t\n'.indexOf(c) < 0) break;
            ws += c;
            reader.consumeNextChar();
        }
        return ws > '' ? ws : false;
    }
    
	function globBlockComment(reader) {
        var c;
        if ((c = reader.peekNextChar()) != '/') return false;
        reader.consumeNextChar();
        if ((c = reader.peekNextChar()) != '*') return false;
        reader.consumeNextChar();
        var text = "/*";
		var star = false;
        while (true) {
            c = reader.peekNextChar();
			text += c;
            reader.consumeNextChar();
            if (c == '*') star = true;
			else if (c == '/' && star) break;
        }
        return text;
	}
	
    function globEolComment(reader) {
        var c;
        if ((c = reader.peekNextChar()) != '/') return false;
        reader.consumeNextChar();
        if ((c = reader.peekNextChar()) != '/') return false;
        reader.consumeNextChar();
        var text = "//";
        while (true) {
            c = reader.peekNextChar();
            if (c == '\n') break;
            text += c;
            reader.consumeNextChar();
        }
        return text;
    }
    
    function _createLexer(reader /*, parser_fun, parser_obj*/) {
        var globbers = [
            { token_type: 'eol_comment', globber: globEolComment },
            { token_type: 'block_comment', globber: globBlockComment },
            { token_type: 'Identifier', globber: globIdentifier },
            { token_type: 'keyword', globber: globKeyword },
            { token_type: 'numeric_constant', globber: globNumericConstant },
            { token_type: 'string_constant', globber: globStringConstant },
            { token_type: 'punctuation', globber: globPunctuation },
            { token_type: 'operator', globber: globOperator },
            { token_type: 'whitespace', globber: globWhitespace },
        ];
        var lexer = Lexer.create(reader, globbers); // parser_fun, parser_obj);
        return lexer;
    }
    
    return {
        createLexer: _createLexer
    }
    
} );