SHELL = /bin/sh
.SUFFIXES:

SRCDIR = src
FINDIR = fin
BUILDDIR = build
IDRIS = idris
IDRISFLAGS_NONJS = -i $(BUILDDIR)/src/idris -p effects
IDRISFLAGS = $(IDRISFLAGS_NONJS) --codegen javascript
NODEJS = nodejs

.PHONY: all clean html nonjs run-nonjs run check-nonjs check $(BUILDDIR)/src

all: $(FINDIR)/contrivertext.js

$(BUILDDIR):
	mkdir -p $@

$(BUILDDIR)/src: $(BUILDDIR) $(SRCDIR)
	rsync -rupE $(SRCDIR)/ $@

$(BUILDDIR)/ContriverText_doc: $(BUILDDIR)/src
	cd $(BUILDDIR) && $(IDRIS) --mkdoc src/idris/contrivertext.ipkg

$(BUILDDIR)/contrivertext-tests: $(BUILDDIR)/src
	$(IDRIS) $</test/Main.idr -o $@ $(IDRISFLAGS_NONJS)

$(BUILDDIR)/contrivertext-tests.js: $(BUILDDIR)/src
	$(IDRIS) $</test/Main.idr -o $@ $(IDRISFLAGS)

$(FINDIR):
	mkdir -p $@

$(FINDIR)/html: $(BUILDDIR)/ContriverText_doc $(FINDIR)
	rsync -rupE $</ $@

$(FINDIR)/contrivertext: $(BUILDDIR)/src $(FINDIR)
	$(IDRIS) $</main/Main.idr -o $@ $(IDRISFLAGS_NONJS)

$(FINDIR)/contrivertext.js: $(BUILDDIR)/src $(FINDIR)
	$(IDRIS) $</main/Main.idr -o $@ $(IDRISFLAGS)

clean:
	rm -rf $(BUILDDIR)/ContriverText_doc
	rm -rf $(BUILDDIR)/src
	rm -f $(BUILDDIR)/contrivertext-tests.js
	rm -rf $(FINDIR)/html
	rm -f $(FINDIR)/contrivertext.js

html: $(FINDIR)/html

nonjs: $(FINDIR)/contrivertext

run-nonjs: $(FINDIR)/contrivertext
	$<

run: $(FINDIR)/contrivertext.js
	nodejs $<

check-nonjs: $(BUILDDIR)/contrivertext-tests
	$<

check: $(BUILDDIR)/contrivertext-tests.js
	nodejs $<

