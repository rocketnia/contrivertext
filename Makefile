SHELL = /bin/sh
.SUFFIXES:

SRCDIR = src
FINDIR = fin
BUILDDIR = build
IDRIS = idris
IDRISFLAGS = -i $(BUILDDIR)/src/idris --codegen javascript
NODEJS = nodejs

.PHONY: all clean check html $(BUILDDIR)/src

all: $(FINDIR)/contrivertext.js

$(BUILDDIR):
	mkdir -p $@

$(BUILDDIR)/ContriverText_doc: $(BUILDDIR)/src
	cd $(BUILDDIR) && $(IDRIS) --mkdoc src/idris/contrivertext.ipkg

$(BUILDDIR)/src: $(BUILDDIR)
	rsync -rupE $(SRCDIR)/ $@

$(BUILDDIR)/contrivertext-tests.js: $(BUILDDIR)/src
	$(IDRIS) $</test/Main.idr -o $@ $(IDRISFLAGS)

$(FINDIR):
	mkdir -p $@

$(FINDIR)/html: $(BUILDDIR)/ContriverText_doc $(FINDIR)
	rsync -rupE $</ $@

$(FINDIR)/contrivertext.js: $(BUILDDIR)/src $(FINDIR)
	$(IDRIS) $</main/Main.idr -o $@ $(IDRISFLAGS)

clean:
	rm -rf $(BUILDDIR)/ContriverText_doc
	rm -rf $(BUILDDIR)/src
	rm -f $(BUILDDIR)/contrivertext-tests.js
	rm -rf $(FINDIR)/html
	rm -f $(FINDIR)/contrivertext.js

check: $(BUILDDIR)/contrivertext-tests.js
	nodejs $<

html: $(FINDIR)/html
