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
                
    var WHITESPACE_CHARS = '\u0009\u000B\u000C \u00A0\uFEFF\u1680\u180E\u2000\u2001\u2002\u2003\u2004'
                          +'\u2005\u2006\u2007\u2008\u2009\u200A\u200B\u202F\u205F\u3000\uFEFF';
                          
    var LINE_TERMINATORS = "\x0D\x0A\u2028\u2029";
    
    var DIGITS = '0123456789';
    var HEX_DIGITS = '0123456789abcdefABCDEF';
    
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
    ], 'IdentifierName');
	
    var keyword = P.filter(identifierName, function(text) {
        return (KEYWORDS.indexOf(text) >= 0);
    });
    
    var nullLiteral = P.filter(identifierName, "null", "NullLiteral");

    var booleanLiteral = P.filter(identifierName, ["true", "false"], "BooleanLiteral");
    
    var reservedWord = P.anyOf([
        keyword,
        nullLiteral,
        //futureReservedWord,
        booleanLiteral ]);
        
    var identifier = P.butNot(identifierName, reservedWord);
    
    var punctuator = P.string( 
        function(c) { return PUNCT_CHARS.indexOf(c) >= 0; }, 
        function(text) { return PUNCTUATORS.indexOf(text) >= 0; },
        "Punctuator"
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

    var hexDigit = P.anyOf(HEX_DIGITS);
    
    var hexIntegerLiteral = P.sequence([
        P.anyOf('0'), P.anyOf("xX"), hexDigit, P.repetition(hexDigit)
    ]);
    
    var numericLiteral = P.anyOf([
        decimalLiteral,
        hexIntegerLiteral
    ]);
    
    var singleEscapeCharacter = P.anyOf('\'"\\bfnrtv');
    
    var nonEscapeCharacter = P.noneOf('\'"\\bfnrtv');
    
    var characterEscapeSequence = P.anyOf([
        singleEscapeCharacter,
        nonEscapeCharacter
    ]);
    
    var hexEscapeSequence = P.sequence([ P.aChar('x'), hexDigit, hexDigit ]);
    
    var unicodeEscapeSequence = P.sequence([ P.aChar('u'), hexDigit, hexDigit, hexDigit, hexDigit ]);
    
    var escapeSequence = P.anyOf([
        characterEscapeSequence,
        P.sequence([ P.aChar('0'), P.aChar('0123456789') ]),
        hexEscapeSequence,
        unicodeEscapeSequence
    ]);
    
    var lineTerminatorSequence = P.anyOf([
        P.aChar('\x0A\u2028\u2029'),
        P.sequence([ P.aChar('\x0D'), P.lookAhead(P.not('\x0A')) ]),
        P.string('\x0D\x0A')        
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

    var literal = P.anyOf([
        nullLiteral,
        booleanLiteral,
        numericLiteral,
        stringLiteral,
        //regularExpressionLiteral
    ]);

    var multiLineCommentChar = P.anyOf([
        P.not('*'),
        P.sequence([ P.aChar('*'), P.lookAhead(P.not('/')) ])
    ]);
    
    var multiLineComment = P.sequence([
        P.string('/*'),
        P.repetition(multiLineCommentChar),
        P.string('*/')
    ]);
    
    var singleLineComment = P.sequence([
        P.string('//'),
        P.repetition( P.noneOf(LINE_TERMINATORS) )
    ]);
    
    var comment = P.anyOf([
        multiLineComment,
        singleLineComment
    ]);
    
    var whiteSpace = P.aChar(WHITESPACE_CHARS, 'WhiteSpace');
    
    var lineTerminator = P.aChar(LINE_TERMINATORS);
    
    var token = P.anyOf([
        identifierName,
        punctuator,
        numericLiteral,
        stringLiteral
    ], "Token");
    
    var _inputElementDiv = P.anyOf([
        whiteSpace,
        lineTerminator,
        comment,
        token,
        punctuator
    ], "InputElementDiv");
    
    /** This module returns the top-level elements of the JavaScript lexical grammar.
     */
    
    return {
        inputElementDiv: _inputElementDiv
    }
    
} );