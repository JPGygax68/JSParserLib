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

    var grammar = {
    
        unicodeLetter: P.aChar( function(c) {
            return (c >= 'A' && c <= 'Z') 
                || (c >= 'a' && c <= 'z');
            // TODO: actual support for Unicode!
        }),
        	
        unicodeDigit: P.aChar( function(c) {
            return (c >= '0' && c <= '9'); // TODO: real Unicode
        }),
	
        identifierStart: P.anyOf( [
            'unicodeLetter',
            P.aChar('$_')
        ]),
	
        identifierPart: P.anyOf( [
            'identifierStart',
            //|| unicodeCombininingMark(c) // TODO
            'unicodeDigit'
            //|| unicodeConnectorPunctuation(c) // TODO
            //|| TODO: zero-width non-joiner, zero-width joiner
        ]),

        identifierName: P.sequence( [
            'identifierStart',
            P.repetition('identifierPart')
        ]),
	
        keyword: P.filter('identifierName', function(text) {
            return (KEYWORDS.indexOf(text) >= 0);
        }),
    
        nullLiteral: P.filter('identifierName', "null"),

        booleanLiteral: P.filter('identifierName', ["true", "false"]),
    
        reservedWord: P.anyOf([
            'keyword',
            'nullLiteral',
            //'futureReservedWord',
            'booleanLiteral'
        ]),
        
        identifier: P.butNot('identifierName', 'reservedWord'),
    
        punctuator: P.string( 
            function(c) { return PUNCT_CHARS.indexOf(c) >= 0; }, 
            function(text) { return PUNCTUATORS.indexOf(text) >= 0; }
        ),
    
        decimalDigits: P.repetition(
            P.aChar("0123456789")
        ),
    
        decimalIntegerLiteral: P.anyOf([
            P.aChar('0'),
            P.sequence([
                P.aChar("12345789"),
                'decimalDigits'
            ])
        ]),
    
        signedInteger: P.anyOf([
            P.sequence( [P.aChar("+-"), 'decimalDigits'] ),
            'decimalDigits'
        ]),
    
        exponentPart: P.sequence([
            P.aChar('eE'), 'signedInteger'
        ]),
    
        decimalLiteral: P.anyOf([
            P.sequence([
                'decimalIntegerLiteral', P.aChar('.'), P.optional('decimalDigits'), P.optional('exponentPart')
            ]),
            P.sequence( [P.aChar('.'), 'decimalDigits', P.optional('exponentPart')] ),
            P.sequence( ['decimalIntegerLiteral', P.optional('exponentPart')] )
        ]),

        hexDigit: P.aChar(HEX_DIGITS),
        
        hexIntegerLiteral: P.sequence([
            P.aChar('0'), P.aChar("xX"), 'hexDigit', P.repetition('hexDigit')
        ]),
    
        numericLiteral: P.anyOf([
            'decimalLiteral',
            'hexIntegerLiteral'
        ]),
    
        singleEscapeCharacter: P.aChar('\'"\\bfnrtv'),
        
        nonEscapeCharacter: P.noneOf('\'"\\bfnrtv'),
        
        characterEscapeSequence: P.anyOf([
            'singleEscapeCharacter',
            'nonEscapeCharacter'
        ]),
    
        hexEscapeSequence: P.sequence([ P.aChar('x'), 'hexDigit', 'hexDigit' ]),
        
        unicodeEscapeSequence: P.sequence([ P.aChar('u'), 'hexDigit', 'hexDigit', 'hexDigit', 'hexDigit' ]),
    
        escapeSequence: P.anyOf([
            'characterEscapeSequence',
            P.sequence([ P.aChar('0'), P.aChar('0123456789') ]),
            'hexEscapeSequence',
            'unicodeEscapeSequence'
        ]),
        
        lineTerminatorSequence: P.anyOf([
            P.aChar('\x0A\u2028\u2029'),
            P.sequence([ P.aChar('\x0D'), P.lookAhead(P.not('\x0A')) ]),
            P.string('\x0D\x0A')        
        ]),
        
        lineContinuation: P.sequence([ P.aChar('\\'), 'lineTerminatorSequence' ]),
        
        doubleStringCharacter: P.anyOf([
            P.noneOf('"\\'+LINE_TERMINATORS),
            P.sequence([ P.aChar('\\'), 'escapeSequence' ]),
            'lineContinuation'
        ]),
        
        singleStringCharacter: P.anyOf([
            P.noneOf("'\\"+LINE_TERMINATORS),
            P.sequence([ P.aChar('\\'), 'escapeSequence' ]),
            'lineContinuation'
        ]),
    
        stringLiteral: P.anyOf([
            P.sequence([
                P.aChar('"'),
                P.repetition('doubleStringCharacter'),
                P.aChar('"')
            ]),
            P.sequence([
                P.aChar("'"),
                P.repetition('singleStringCharacter'),
                P.aChar("'")
            ])
        ]),

        literal: P.anyOf([
            'nullLiteral',
            'booleanLiteral',
            'numericLiteral',
            'stringLiteral',
            //'regularExpressionLiteral'
        ]),

        multiLineCommentChar: P.anyOf([
            P.not('*'),
            P.sequence([ P.aChar('*'), P.lookAhead(P.not('/')) ])
        ]),
        
        multiLineComment: P.sequence([
            P.string('/*'),
            P.repetition('multiLineCommentChar'),
            P.string('*/')
        ]),
        
        singleLineComment: P.sequence([
            P.string('//'),
            P.repetition( P.noneOf(LINE_TERMINATORS) )
        ]),
        
        comment: P.anyOf([
            'multiLineComment',
            'singleLineComment'
        ]),
    
        whiteSpace: P.aChar(WHITESPACE_CHARS),
        
        lineTerminator: P.aChar(LINE_TERMINATORS),
        
        token: P.anyOf([
            'identifierName',
            'punctuator',
            'numericLiteral',
            'stringLiteral'
        ]),
        
        inputElementDiv: P.anyOf([
            'whiteSpace',
            'lineTerminator',
            'comment',
            'token',
            'punctuator'
        ])
    };
    
    return grammar;
    
} );