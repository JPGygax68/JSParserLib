define(["./parser"], function(P) {

    var KEYWORDS = ("break do instanceof typeof case else new var catch finally return void "
                  + "continue for switch while debugger function this with default if throw "
                  + "delete in try").split(' ');

    var FUTURE_RESERVED_WORDS = ("class enum extends super const export import").split(' ');
    
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

    var g = {};
    
    g.unicodeLetter = P.aChar( function(c) {
        return (c >= 'A' && c <= 'Z') 
            || (c >= 'a' && c <= 'z');
        // TODO: actual support for Unicode!
    });
        
    g.unicodeDigit = P.aChar( function(c) {
        return (c >= '0' && c <= '9'); // TODO: real Unicode
    });

    g.identifierStart = P.anyOf( [
        g.unicodeLetter,
        P.anyOf('$_')
    ]),

    g.identifierPart = P.anyOf( [
        g.identifierStart,
        //|| g.unicodeCombininingMark(c) // TODO
        g.unicodeDigit
        //|| g.unicodeConnectorPunctuation(c) // TODO
        //|| TODO: zero-width non-joiner, zero-width joiner
    ]),

    g.identifierName = P.sequence( [
        g.identifierStart,
        P.repetition(g.identifierPart)
    ]);

    g.keyword = P.filter(g.identifierName, function(text) {
        return  (KEYWORDS.indexOf(text) >= 0);
    });

    g.nullLiteral = P.filter(g.identifierName, "null");

    g.booleanLiteral = P.filter(g.identifierName, ["true", "false"]);

    g.futureReservedWord = P.filter(g.identifierName, function(text) {
        return  (FUTURE_RESERVED_WORDS.indexOf(text) >= 0);
    });
    
    g.reservedWord = P.anyOf([
        g.keyword,
        g.nullLiteral,
        g.futureReservedWord,
        g.booleanLiteral 
    ]);
    
    g.identifier = P.butNot(g.identifierName, g.reservedWord);

    g.punctuator = P.string( 
        function(c) { return PUNCT_CHARS.indexOf(c) >= 0; }, 
        function(text) { return PUNCTUATORS.indexOf(text) >= 0; }
    );

    g.decimalDigits = P.repetition(
        P.anyOf("0123456789")
    );

    g.decimalIntegerLiteral = P.anyOf([
        P.anyOf('0'),
        P.sequence([
            P.anyOf("12345789"),
            g.decimalDigits
        ])
    ]);

    g.signedInteger = P.anyOf([
        P.sequence( [P.anyOf("+-"), g.decimalDigits] ),
        g.decimalDigits
    ]);

    g.exponentPart = P.sequence([
        P.anyOf('eE'), g.signedInteger
    ]);

    g.decimalLiteral = P.anyOf([
        P.sequence([
            g.decimalIntegerLiteral, P.anyOf('.'), P.optional(g.decimalDigits), P.optional(g.exponentPart)
        ]),
        P.sequence( [P.anyOf('.'), g.decimalDigits, P.optional(g.exponentPart)] ),
        P.sequence( [g.decimalIntegerLiteral, P.optional(g.exponentPart)] )
    ]);

    g.hexDigit = P.anyOf(HEX_DIGITS),
    
    g.hexIntegerLiteral = P.sequence([
        P.anyOf('0'), P.anyOf("xX"), g.hexDigit, P.repetition(g.hexDigit) // TODO: use "string" instead ?
    ]);

    g.numericLiteral = P.anyOf([
        g.decimalLiteral,
        g.hexIntegerLiteral
    ]);

    g.singleEscapeCharacter = P.anyOf('\'"\\bfnrtv');
    
    g.nonEscapeCharacter = P.noneOf('\'"\\bfnrtv');
    
    g.characterEscapeSequence = P.anyOf([
        g.singleEscapeCharacter,
        g.nonEscapeCharacter
    ]);

    g.hexEscapeSequence = P.sequence([ P.aChar('x'), g.hexDigit, g.hexDigit ]);
    
    g.unicodeEscapeSequence = P.sequence([ P.aChar('u'), g.hexDigit, g.hexDigit, g.hexDigit, g.hexDigit ]);

    g.escapeSequence = P.anyOf([
        g.characterEscapeSequence,
        P.sequence([ P.aChar('0'), P.aChar('0123456789') ]),
        g.hexEscapeSequence,
        g.unicodeEscapeSequence
    ]);
    
    g.lineTerminatorSequence = P.anyOf([
        P.aChar('\x0A\u2028\u2029'),
        P.sequence([ P.aChar('\x0D'), P.lookAhead(P.not('\x0A')) ]),
        P.sequence('\x0D\x0A')        
    ]);
    
    g.lineContinuation = P.sequence([ P.anyOf('\\'), g.lineTerminatorSequence ]);
    
    g.doubleStringCharacter = P.anyOf([
        P.noneOf('"\\'+LINE_TERMINATORS),
        P.sequence([ P.anyOf('\\'), g.escapeSequence ]),
        g.lineContinuation
    ]);
    
    g.singleStringCharacter = P.anyOf([
        P.noneOf("'\\"+LINE_TERMINATORS),
        P.sequence([ P.anyOf('\\'), g.escapeSequence ]),
        g.lineContinuation
    ]);

    g.stringLiteral = P.anyOf([
        P.sequence([
            P.anyOf('"'),
            P.repetition(g.doubleStringCharacter),
            P.anyOf('"')
        ]),
        P.sequence([
            P.anyOf("'"),
            P.repetition(g.singleStringCharacter),
            P.anyOf("'")
        ])
    ]);

    g.regularExpressionNonTerminator = P.noneOf(LINE_TERMINATORS);
    
    g.regularExpressionBackslashSequence = P.sequence([ P.aChar('\\'), g.regularExpressionNonTerminator ]);
    
    g.regularExpressionClassChar = P.anyOf([
        P.butNot(g.regularExpressionNonTerminator, P.anyOf(']\\')),
        g.regularExpressionBackslashSequence
    ]);
    
    g.regularExpressionClass = P.sequence([
        P.aChar('['),
        P.repetition(g.regularExpressionClassChar),
        P.aChar(']')
    ]);
    
    g.regularExpressionFirstChar = P.anyOf([
        P.butNot(g.regularExpressionNonTerminator, P.anyOf('*\\/[')),
        g.regularExpressionBackslashSequence,
        g.regularExpressionClass
    ]);
    
    g.regularExpressionChar = P.anyOf([
        P.butNot(g.regularExpressionNonTerminator, P.anyOf('\\/[')),
        g.regularExpressionBackslashSequence,
        g.regularExpressionClass
    ]);
    
    g.regularExpressionBody = P.sequence([
        g.regularExpressionFirstChar,
        P.repetition(g.regularExpressionChar)
    ]);
    
    g.regularExpressionFlags = P.repetition(g.identifierPart);
    
    g.regularExpressionLiteral = P.sequence([
        P.aChar('/'),
        g.regularExpressionBody,
        P.aChar('/'),
        g.regularExpressionFlags
    ]);
    
    g.literal = P.anyOf([
        g.nullLiteral,
        g.booleanLiteral,
        g.numericLiteral,
        g.stringLiteral,
        g.regularExpressionLiteral
    ]);

    g.multiLineCommentChar = P.anyOf([
        P.not('*'),
        P.sequence([ P.aChar('*'), P.lookAhead(P.not('/')) ])
    ]);
    
    g.multiLineComment = P.sequence([
        P.sequence('/*'),
        P.repetition(g.multiLineCommentChar),
        P.sequence('*/')
    ]),
    
    g.singleLineComment = P.sequence([
        P.sequence('//'),
        P.repetition( P.noneOf(LINE_TERMINATORS) )
    ]);
    
    g.comment = P.anyOf([
        g.multiLineComment,
        g.singleLineComment
    ]);

    g.whiteSpace = P.aChar(WHITESPACE_CHARS);
    
    g.lineTerminator = P.aChar(LINE_TERMINATORS);
    
    g.token = P.anyOf([
        g.identifierName,
        g.punctuator,
        g.numericLiteral,
        g.stringLiteral
    ]);
    
    g.inputElementDiv = P.anyOf([
        g.whiteSpace,
        g.lineTerminator,
        g.comment,
        g.token,
        g.punctuator
    ]);
    
    // The following two rules are useful for syntax highlighting
    
    g.token2 = P.anyOf([
        g.identifier,
        g.reservedWord,
        g.punctuator,
        g.numericLiteral,
        g.stringLiteral,
        g.regularExpressionLiteral
    ]);
    
    g.inputElement2 = P.anyOf([
        g.whiteSpace,
        g.lineTerminator,
        g.comment,
        g.token2,
        g.punctuator
    ]);
    
    return P.finalizeGrammar(g); // return the grammar
} );