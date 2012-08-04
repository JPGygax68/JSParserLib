define(["./lexer"], function(L) {

    var KEYWORDS = [
        'function', 'var', 'break', 'return', 'true', 'false', 'while', 'for', 'do', 'break', 'in', 'this',
        'new', 'try', 'catch', 'throw', 'finally'
    ];

    var PUNCTUATORS = ("{ } ( ) [ ] . ; , < > <= >= == != === !== + - * % "
                     + "++ -- << >> >>> & | ^ ! ~ && || ? : = += -= *= %= "
                     + "<<= >>= >>>= &= |= ^=").split(' ');
    var PUNCT_CHARS = (function() { 
        var s = '', c, i, j;
        for (i = 0; i < PUNCTUATORS.length; i++)
            for (j = 0; j < PUNCTUATORS[i].length; j++)
                if (s.indexOf((c = PUNCTUATORS[i][j])) < 0) s += c;
        return s;
    })();
                     
	// Vocabulary 
	
	var unicodeLetter = L.singleChar( function(c) {
        return (c >= 'A' && c <= 'Z') 
            || (c >= 'a' && c <= 'z');
        // TODO: actual support for Unicode!
    });
	
	var unicodeDigit = L.singleChar( function(c) {
		return (c >= '0' && c <= '9');
	});
	
	var identifierStart = L.anyOf( [
        unicodeLetter,
        L.singleChar( function(c) { return (c === '$') || (c === '_'); })
    ]);
	
	var identifierPart = L.anyOf( [
        identifierStart,
        //|| unicodeCombininingMark(c) // TODO
        unicodeDigit
        //|| unicodeConnectorPunctuation(c) // TODO
        //|| TODO: zero-width non-joiner, zero-width joiner
    ]);

    var identifierName = L.sequence( [
        identifierStart,
        L.repetition(identifierPart)
    ]);
	
    var keyword = L.filter(identifierName, function(text) {
        return (KEYWORDS.indexOf(text) >= 0);
    });
    
    var identifier = L.filter(identifierName, function(text) {
        return KEYWORDS.indexOf(text) < 0;
    });
    
    var punctuator = L.greedy( 
        function(c) { return PUNCT_CHARS.indexOf(c) >= 0; }, 
        function(text) { return PUNCTUATORS.indexOf(text) >= 0; }
    );
    
    var decimalDigits = L.repetition(
        L.singleChar("0123456789")
    );
    
    var decimalIntegerLiteral = L.anyOf([
        L.singleChar('0'),
        L.sequence([
            L.singleChar("12345789"),
            decimalDigits
        ])
    ]);
    
    var decimalLiteral = L.anyOf([
        L.sequence([
            decimalIntegerLiteral, L.singleChar('0'), L.optional(decimalDigits)
        ])
    ]);
    
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
            { token_type: 'identifier', globber: identifier },
            { token_type: 'keyword', globber: keyword },
            { token_type: 'decimalIntegerLiteral', globber: decimalIntegerLiteral },
            { token_type: 'string_constant', globber: globStringConstant },
            { token_type: 'punctuator', globber: punctuator },
            { token_type: 'operator', globber: globOperator },
            { token_type: 'whitespace', globber: globWhitespace },
        ];
        var lexer = L.create(reader, globbers); // parser_fun, parser_obj);
        return lexer;
    }
    
    return {
        createLexer: _createLexer
    }
    
} );