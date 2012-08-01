define( function() {

    function _convertWhitespace(text, tab_width, base_indent) {
		var indent = -1;
		var html = '';
		for (var i = 0; i < text.length; i++) {
			if (text[i] == '\n') {
				indent = 0;
				html += '<br/>';
			}
			else if (text[i] == '\t') {
				if (indent >= 0) {
					for (var j = 0; j < tab_width; j++) {
						indent += 1;
						if (indent > base_indent) html += '&nbsp;';
					}
				}
				else
					html += '&nbsp;';
			}
			else if (text[i] == ' ') {
				if (indent >= 0) {
					indent += 1;
					if (indent > base_indent) html += '&nbsp;';
				}
				else
					html += '&nbsp;';
			}
			else {
				html += text[i];
			}
		}
		return html;
    }
	
	return {
		whitespaceToHtml: _convertWhitespace
	}
});