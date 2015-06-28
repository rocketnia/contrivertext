SHELL = /bin/sh
.SUFFIXES:

SRCDIR = src
FINDIR = fin
BUILDDIR = build

IDRIS = idris
NODEJS = nodejs

IDRISFLAGS_NONJS = -i $(BUILDDIR)/src/idris -p effects
IDRISFLAGS = $(IDRISFLAGS_NONJS) --codegen javascript

.PHONY: all clean html nonjs run-nonjs run check-nonjs check

all: $(FINDIR)/contrivertext.js

$(BUILDDIR):
	mkdir -p $@

# thanks to http://stackoverflow.com/questions/3100776/how-to-copy-a-directory-in-a-makefile/3100872#3100872
SRC_FILES := $(patsubst $(SRCDIR)/%,$(BUILDDIR)/src/%,$(shell find $(SRCDIR) -type f))
$(BUILDDIR)/src/%: $(SRCDIR)/%
	mkdir -p $(@D)
	cp $< $@

$(BUILDDIR)/ContriverText_doc: $(SRC_FILES)
	cd $(BUILDDIR) && $(IDRIS) --mkdoc src/idris/contrivertext.ipkg

$(BUILDDIR)/contrivertext-tests: $(SRC_FILES)
	$(IDRIS) $(BUILDDIR)/src/test/Main.idr -o $@ $(IDRISFLAGS_NONJS)

$(BUILDDIR)/contrivertext-tests.js: $(SRC_FILES)
	$(IDRIS) $(BUILDDIR)/src/test/Main.idr -o $@ $(IDRISFLAGS)

$(FINDIR):
	mkdir -p $@

$(FINDIR)/html: $(BUILDDIR)/ContriverText_doc $(FINDIR)
	rsync -urtpE $</ $@

$(FINDIR)/contrivertext: $(SRC_FILES) $(FINDIR)
	$(IDRIS) $(BUILDDIR)/src/main/Main.idr -o $@ $(IDRISFLAGS_NONJS)

$(FINDIR)/contrivertext.js: $(SRC_FILES) $(FINDIR)
	$(IDRIS) $(BUILDDIR)/src/main/Main.idr -o $@ $(IDRISFLAGS)

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
	$(NODEJS) $<

check-nonjs: $(BUILDDIR)/contrivertext-tests
	$<

check: $(BUILDDIR)/contrivertext-tests.js
	$(NODEJS) $<

