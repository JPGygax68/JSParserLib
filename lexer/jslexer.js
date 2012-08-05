define(["./lexer"], function(L) {

    var KEYWORDS = ("break do instanceof typeof case else new var catch finally return void "
                  + "continue for switch while debugger function this with default if throw "
                  + "delete in try").split(' ');

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
                
    var LINE_TERMINATORS = "\x0d\x0a"; // TODO: other line terminators
    
	// Vocabulary 
	
	var unicodeLetter = L.anyChar( function(c) {
        return (c >= 'A' && c <= 'Z') 
            || (c >= 'a' && c <= 'z');
        // TODO: actual support for Unicode!
    });
	
	var unicodeDigit = L.anyChar( function(c) {
		return (c >= '0' && c <= '9'); // TODO: real Unicode
	});
	
	var identifierStart = L.anyOf( [
        unicodeLetter,
        L.anyOf('$_')
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
    
    var nullLiteral = L.filter(identifierName, "null");

    var booleanLiteral = L.filter(identifierName, ["true", "false"]);
    
    var reservedWord = L.anyOf([
        keyword,
        nullLiteral,
        //futureReservedWord,
        booleanLiteral ]);
        
    var identifier = L.butNot(identifierName, reservedWord);
    
    var punctuator = L.greedy( 
        function(c) { return PUNCT_CHARS.indexOf(c) >= 0; }, 
        function(text) { return PUNCTUATORS.indexOf(text) >= 0; }
    );
    
    var decimalDigits = L.repetition(
        L.anyOf("0123456789")
    );
    
    var decimalIntegerLiteral = L.anyOf([
        L.anyOf('0'),
        L.sequence([
            L.anyOf("12345789"),
            decimalDigits
        ])
    ]);
    
    var signedInteger = L.anyOf([
        L.sequence( [L.anyOf("+-"), decimalDigits] ),
        decimalDigits
    ]);
    
    var exponentPart = L.sequence([
        L.anyOf('eE'), signedInteger
    ]);
    
    var decimalLiteral = L.anyOf([
        L.sequence([
            decimalIntegerLiteral, L.anyOf('.'), L.optional(decimalDigits), L.optional(exponentPart)
        ]),
        L.sequence( [L.anyOf('.'), decimalDigits, L.optional(exponentPart)] ),
        L.sequence( [decimalIntegerLiteral, L.optional(exponentPart)] )
    ]);

    var hexDigit = L.anyOf("0123456789abcdefABCDEF");
    
    var hexIntegerLiteral = L.sequence([
        L.anyOf('0'), L.anyOf("xX"), hexDigit, L.repetition(hexDigit)
    ]);
    
    var numericLiteral = L.anyOf([
        decimalLiteral,
        hexIntegerLiteral
    ]);
    
    //var notLineTerminator = L.anyOf('"\\x0d\x0a', true); // TODO: other line terminators
    
    var literal = L.anyOf([
        nullLiteral,
        booleanLiteral,
        numericLiteral
        //stringLiteral,
        //regularExpressionLiteral
    ]);

    var singleEscapeCharacter = L.anyOf('\'"\\bfnrtv');
    
    var nonEscapeCharacter = L.noneOf('\'"\\bfnrtv');
    
    var characterEscapeSequence = L.anyOf([
        singleEscapeCharacter,
        nonEscapeCharacter
    ]);
    
    var escapeSequence = L.anyOf([
        characterEscapeSequence
        // TODO: the rest...
    ]);
    
    var doubleStringCharacter = L.anyOf([
        L.noneOf('"\\'+LINE_TERMINATORS),
        L.sequence([L.anyOf('\\'), escapeSequence])
        // TODO: lineContinuation
    ]);
    
    var singleStringCharacter = L.anyOf([
        L.noneOf("'\\"+LINE_TERMINATORS),
        L.sequence([L.anyOf('\\'), escapeSequence])
        // TODO: lineContinuation
    ]);
    
    var stringLiteral = L.anyOf([
        L.sequence([
            L.anyOf('"'),
            L.repetition(doubleStringCharacter),
            L.anyOf('"')
        ]),
        L.sequence([
            L.anyOf("'"),
            L.repetition(singleStringCharacter),
            L.anyOf("'")
        ])
    ]);
    
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
            { token_type: 'literal', globber: literal },
            { token_type: 'stringLiteral', globber: stringLiteral },
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