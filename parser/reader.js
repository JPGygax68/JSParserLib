define(["./charclasses"], function(CharClasses) {

	//--- SourceReader class ------------------------------------------------*/
	
	/** Constructor
	 */
	function SourceReader(text) {
		this.text = text;
		this.marks = undefined;
		this.tab_width = 4; // TODO: configurable
		this.i = 0; // TODO: wrap in getter method
		this.row = 0;
		this.col = 0;
		this.indent = 0;
	}
	
    SourceReader.prototype.getCurrentPos = function() {
        return { i: this.i, row: this.row, col: this.col };
    }
    
    SourceReader.prototype.goToPos = function(pos) {
        this.i = pos.i; this.row = pos.row; this.col = pos.col;
    }
    
	SourceReader.prototype.savePos = function() {
        if (typeof (this.marks) === 'undefined')
            this.marks = [];
        this.marks.push( this.getCurrentPos() );
	}
	
	SourceReader.prototype.restorePos = function() {
        var pos = this.marks.pop();
        this.goToPos(pos);
	}

	SourceReader.prototype.dropLastMark = function() {
		this.marks.pop();
	}
	
    SourceReader.prototype.peekNextChar = function () {
        if (this.i >= this.text.length)
            return null;
        return this.text[this.i];
    }

    SourceReader.prototype.consumeNextChar = function() {
        var c = this.peekNextChar();
        if (c) {
            if (c === '\n') {
                this.row++; this.col = 0;
            }
            else if (c === '\t') {
                this.col += this.tab_width; // TODO: where to keep options like this ?
            }
            else if (c === ' ') {
                this.col++;
            }
        }
        this.i++;
        return c;
    }

    SourceReader.prototype.skipWhitespace = function() {
        var found = false;
        var c;
        while ((c = this.peekNextChar())) {
            if (!CharClasses.isWhitespace(c)) break;
            this.consumeNextChar();
            found = true;
        }
        return found;
    }

	//--- END SourceReader class

	// PUBLIC API
	
	return {
		createReader: function(text) { return new SourceReader(text); }
	}
});
	