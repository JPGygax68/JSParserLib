define(["../lexer/sourcereader", "../lexer/charclasses", "./util"], 

function(SourceReader, CharClasses, Util) {

	/** Takes source code embedded in a tag and converts it to properly indented 
	 *	span elements.
	 */
	function _format($elt) {
	
		// Get text from element
		var text = $elt.html();
		
		// Create Reader; skip initial whitespace, then mark column as base indent
		var reader = SourceReader.create(text);
		reader.skipWhitespace();
		var base_indent = reader.col;

		// Convert the text
		var html = '';
		var ch;
		while (true) {
			// Handle whitespace
			var s = '';
			while (CharClasses.isWhitespace((ch = reader.peekNextChar()))) {
				s += ch;
				reader.consumeNextChar();
			}
			if (s > '') html += Util.whitespaceToHtml(s, reader.tab_width, base_indent);
			// Stop here if out of characters
			ch = reader.peekNextChar();
			if (ch == null) break;
			// Pack all non-whitespace into a span
			html += '<span>';
			while (ch != null && !CharClasses.isWhitespace(ch)) {
				html += ch;
				reader.consumeNextChar();
				ch = reader.peekNextChar();
			}
			html += '</span>';
		}

		// Replace original code with converted code
		$elt.html(html);
	}
	
	return {
		format: _format
	}
});