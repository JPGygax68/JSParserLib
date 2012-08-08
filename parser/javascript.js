define(["./parser"], function(P) {

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
                
    var LINE_TERMINATORS = "\x0D\x0A"; // TODO: other line terminators
    
	// Vocabulary 
	
	var unicodeLetter = P.aChar( function(c) {
        return (c >= 'A' && c <= 'Z') 
            || (c >= 'a' && c <= 'z');
        // TODO: actual support for Unicode!
    });
	
	var unicodeDigit = P.aChar( function(c) {
		return (c >= '0' && c <= '9'); // TODO: real Unicode
	});
	
	var identifierStart = P.anyOf( [
        unicodeLetter,
        P.anyOf('$_')
    ]);
	
	var identifierPart = P.anyOf( [
        identifierStart,
        //|| unicodeCombininingMark(c) // TODO
        unicodeDigit
        //|| unicodeConnectorPunctuation(c) // TODO
        //|| TODO: zero-width non-joiner, zero-width joiner
    ]);

    var identifierName = P.sequence( [
        identifierStart,
        P.repetition(identifierPart)
    ]);
	
    var keyword = P.filter(identifierName, function(text) {
        return (KEYWORDS.indexOf(text) >= 0);
    });
    
    var nullLiteral = P.filter(identifierName, "null");

    var booleanLiteral = P.filter(identifierName, ["true", "false"]);
    
    var reservedWord = P.anyOf([
        keyword,
        nullLiteral,
        //futureReservedWord,
        booleanLiteral ]);
        
    var identifier = P.butNot(identifierName, reservedWord);
    
    var punctuator = P.greedy( 
        function(c) { return PUNCT_CHARS.indexOf(c) >= 0; }, 
        function(text) { return PUNCTUATORS.indexOf(text) >= 0; }
    );
    
    var decimalDigits = P.repetition(
        P.anyOf("0123456789")
    );
    
    var decimalIntegerLiteral = P.anyOf([
        P.anyOf('0'),
        P.sequence([
            P.anyOf("12345789"),
            decimalDigits
        ])
    ]);
    
    var signedInteger = P.anyOf([
        P.sequence( [P.anyOf("+-"), decimalDigits] ),
        decimalDigits
    ]);
    
    var exponentPart = P.sequence([
        P.anyOf('eE'), signedInteger
    ]);
    
    var decimalLiteral = P.anyOf([
        P.sequence([
            decimalIntegerLiteral, P.anyOf('.'), P.optional(decimalDigits), P.optional(exponentPart)
        ]),
        P.sequence( [P.anyOf('.'), decimalDigits, P.optional(exponentPart)] ),
        P.sequence( [decimalIntegerLiteral, P.optional(exponentPart)] )
    ]);

    var hexDigit = P.anyOf("0123456789abcdefABCDEF");
    
    var hexIntegerLiteral = P.sequence([
        P.anyOf('0'), P.anyOf("xX"), hexDigit, P.repetition(hexDigit)
    ]);
    
    var numericLiteral = P.anyOf([
        decimalLiteral,
        hexIntegerLiteral
    ]);
    
    var literal = P.anyOf([
        nullLiteral,
        booleanLiteral,
        numericLiteral
        //stringLiteral,
        //regularExpressionLiteral
    ]);

    var singleEscapeCharacter = P.anyOf('\'"\\bfnrtv');
    
    var nonEscapeCharacter = P.noneOf('\'"\\bfnrtv');
    
    var characterEscapeSequence = P.anyOf([
        singleEscapeCharacter,
        nonEscapeCharacter
    ]);
    
    var escapeSequence = P.anyOf([
        characterEscapeSequence,
        P.sequence([ P.aChar('0'), P.aChar('0123456789') ])
        // TODO: the rest...
    ]);
    
    var lineTerminatorSequence = P.anyOf([
        P.aChar('\x0A'),
        P.sequence([ P.aChar('\x0D'), P.lookAhead(P.not('\x0A')) ]),
        // TODO: LS
        // TODO: PS
        P.sequence('\x0D\x0A')        
    ]);
    
    var lineContinuation = P.sequence([ P.anyOf('\\'), lineTerminatorSequence ]);
    
    var doubleStringCharacter = P.anyOf([
        P.noneOf('"\\'+LINE_TERMINATORS),
        P.sequence([ P.anyOf('\\'), escapeSequence ]),
        lineContinuation
    ]);
    
    var singleStringCharacter = P.anyOf([
        P.noneOf("'\\"+LINE_TERMINATORS),
        P.sequence([ P.anyOf('\\'), escapeSequence ]),
        lineContinuation
    ]);
    
    var stringLiteral = P.anyOf([
        P.sequence([
            P.anyOf('"'),
            P.repetition(doubleStringCharacter),
            P.anyOf('"')
        ]),
        P.sequence([
            P.anyOf("'"),
            P.repetition(singleStringCharacter),
            P.anyOf("'")
        ])
    ]);

    var multiLineCommentChar = P.anyOf([
        P.not('*'),
        P.sequence([ P.aChar('*'), P.lookAhead(P.not('/')) ]),
    ]);
    
    var multiLineComment = P.sequence([
        P.sequence('/*'),
        P.repetition(multiLineCommentChar),
        P.sequence('*/')
    ]);
    
    var singleLineComment = P.sequence([
        P.sequence('//'),
        P.repetition( P.noneOf(LINE_TERMINATORS) )
    ]);
    
    var comment = P.anyOf([
        multiLineComment,
        singleLineComment
    ]);
    
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
    
    // This module returns a grammar.
    
    return [
        //{ token_type: 'eol_comment', rule: globEolComment },
        { token_type: 'comment', rule: comment },
        { token_type: 'identifier', rule: identifier },
        { token_type: 'keyword', rule: keyword },
        { token_type: 'literal', rule: literal },
        { token_type: 'stringLiteral', rule: stringLiteral },
        { token_type: 'punctuator', rule: punctuator },
        //{ token_type: 'operator', rule: globOperator },
        { token_type: 'whitespace', rule: globWhitespace }
    ];
    
} );