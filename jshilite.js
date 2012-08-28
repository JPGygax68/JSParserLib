/** jshilite.js
 *
 *  This module provides a function that will take a string containing JavaScript source
 *  and return a DOM <pre> element containing <span> elements tagged with class names
 *  indicating the token types.
 *  In combination with some CSS, this is enough to create a JS syntax highlighter.
 */
define(['./stringreader', './parser', './javascript'], function(Reader, Parser, JS) {

    var KEYWORDS = ("break do instanceof typeof case else new var catch finally return void "
                  + "continue for switch while debugger function this with default if throw "
                  + "delete in try").split(' ');

    var FUTURE_RESERVED_WORDS = ("class enum extends super const export import").split(' ');
    
    return function(source) {
        var reader = Reader.createReader(source);
        var parser = Parser.createParser(reader, JS.inputElementRegExp);
        var elem;
        var i = 0;
        var $cont = $('<pre>').addClass('code').addClass('javascript');
        var last_type = '', $last_node;
        while ((elem = parser.getNextElement()) !== false) {
            var $node;
            if (elem.getType() === 'whiteSpace' && $last_node && $last_node.hasClass('whiteSpace')) {
              $last_node.text( $last_node.text() + elem.getText() );
            }
            else {
              var text = elem.getText()
              $node = $('<span>').addClass( elem.getSubTypes().join(' ') ).text( text );
              if (elem.getType() === 'identifierName') {
                if (KEYWORDS.indexOf(text) >= 0) $node.addClass('keyword').addClass('reservedWord');
                if (FUTURE_RESERVED_WORDS.indexOf(text) >= 0) $node.addClass('futureReservedWord').addClass('reservedWord');
                if (['true', 'false'].indexOf(text) >= 0) $node.addClass('booleanLiteral').addClass('literal');
                if (text === 'null') $node.addClass('nullLiteral').addClass('literal');
              }
            }
            $cont.append( $node );
            $last_node = $node;
            i += 1;
            if (i > 1000) throw "forced stop";
        }
        
        return $cont[0];
    }
    
});