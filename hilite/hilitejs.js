
/**    TODO: implement the "tracker" as OOP for easier use in syntax plugins
    TODO: support multiple vocabularies and nesting them (syntax plugins)
 */
 
define([
    "../lexer/sourcereader", 
    "../lexer/jslexer",
    "./util"
    ],

function (SourceReader, JSLexer, Util) {

    //--- Namespace-private functions, variables, constants -------------------

    /** The JavaScript syntax highlighting function highlight() returns a map object
     *    featuring a findElements() method. That method must be given a search string,
     *  and will return a list of those among the elements created by highlight() that 
     *  now (after the highlighting transformation) contain the searched for string.
     */
    function map_findElements(searchstr) {
        var offs = this.text.indexOf(searchstr);
        if (offs < 0) throw 'Could not find "'+searchstr+'"';
        // Look for the fragment where the searched string begins
        var i;
        for (i = 0; i < this.index.length && offs >= this.index[i].offs; i++);
        if (i == 0) return false; // this should not happen
        i--; // one back after shooting past
        // Collect all elements until the whole searched string is covered
        var elts = $([]);
        var len = 0;
        for (; len < searchstr.length; i++) {
            elts = elts.add($(this.index[i].elt));
            //console.log(elts);
            len += this.index[i].len;
        }
        console.log(elts);
        return elts;
    }

    function parseToken(token_type, token_val, reader) {

        // Special handling for whitespace
        var content = Util.whitespaceToHtml(token_val, this.tab_width, this.base_indent)
        var html = '<span class="hjs_'+token_type+'">' + content + '</span>';

        // Create new element, append to the container
        var $e = $(html);
        this.frag.appendChild($e[0]);

        // Add element to the map
        this.map.index.push({ offs: reader.offs, elt: $e[0], len: reader.i - this.offs });
    }
    
    function _highlight($elt) {
    
        // Get text from element, then clear it
        var text = $elt.text();
        //$elt.text('');
        
        // Create Reader, Lexer, Parser object, and element map
        var map = { text: text, index: [] };
        var parser_obj = { html: '', frag: document.createDocumentFragment(), map: map };
        var reader = SourceReader.create(text);
        var lexer = JSLexer.create(reader, parseToken, parser_obj);
        
        // Skip initial whitespace, then mark column as base indent
        reader.skipWhitespace();
        lexer.parser_obj.base_indent = reader.col;
        
        while (true) {
            parser_obj.offs = reader.i;
            if (! lexer.getNextToken()) break;
            //console.log(frag);
        }
        
        // Finalize and return the element map
        $elt.text('');
        $elt.append(parser_obj.frag);
        map.findElements = map_findElements;
        return map;
    }
    
    //--- Return public functions ---------------------------------------------

    return {
        highlight: function ($elt) { return _highlight($elt); }
    }

});