SHELL = /bin/sh
.SUFFIXES:

SRCDIR = src
FINDIR = fin
BUILDDIR = build

IDRIS = idris
NODEJS = nodejs

IDRISFLAGS = -i $(BUILDDIR)/src/idris -p contrib -p effects

.PHONY: all clean html nonjs run-nonjs run check-nonjs check

# thanks to http://stackoverflow.com/questions/3100776/how-to-copy-a-directory-in-a-makefile/3100872#3100872
IDRIS_SRC_FILES := $(patsubst $(SRCDIR)/idris/%,$(BUILDDIR)/src/idris/%,$(shell find $(SRCDIR)/idris -type f))
LOCAL_WEB_SRC_FILES := $(patsubst $(SRCDIR)/local-web/%,$(FINDIR)/local-web/%,$(shell find $(SRCDIR)/local-web -type f))

all: $(FINDIR)/local-web/contrivertext.js $(LOCAL_WEB_SRC_FILES)

$(BUILDDIR):
	mkdir -p $@

$(BUILDDIR)/src/%: $(SRCDIR)/%
	mkdir -p $(@D)
	cp $< $@

$(BUILDDIR)/ContriverText_doc: $(IDRIS_SRC_FILES)
	cd $(BUILDDIR) && $(IDRIS) --mkdoc src/idris/contrivertext.ipkg

$(BUILDDIR)/contrivertext-tests: $(BUILDDIR)/src/idris-main/check-nonjs.idr $(IDRIS_SRC_FILES)
	$(IDRIS) $< -o $@ $(IDRISFLAGS)

$(BUILDDIR)/contrivertext-tests.js: $(BUILDDIR)/src/idris-main/check.idr $(IDRIS_SRC_FILES)
	$(IDRIS) $< -o $@ $(IDRISFLAGS) --codegen node

$(FINDIR):
	mkdir -p $@

$(FINDIR)/doc/html: $(BUILDDIR)/ContriverText_doc $(FINDIR)
	rsync -urtpE $</ $@

$(FINDIR)/local-web: $(FINDIR)
	mkdir -p $@

$(FINDIR)/local-web/contrivertext.js: $(BUILDDIR)/src/idris-main/run.idr $(IDRIS_SRC_FILES) $(FINDIR)/local-web
	$(IDRIS) $< -o $@ $(IDRISFLAGS) --codegen javascript

$(FINDIR)/local-web/%: $(BUILDDIR)/src/local-web/%
	mkdir -p $(@D)
	cp $< $@

$(FINDIR)/contrivertext: $(BUILDDIR)/src/idris-main/run-nonjs.idr $(IDRIS_SRC_FILES) $(FINDIR)
	$(IDRIS) $< -o $@ $(IDRISFLAGS)

clean:
	rm -rf $(BUILDDIR)/ContriverText_doc
	rm -rf $(BUILDDIR)/src
	rm -f $(BUILDDIR)/contrivertext-tests.js
	rm -rf $(FINDIR)/doc/html
	rm -rf $(FINDIR)/html  # legacy location of doc/html
	rm -rf $(FINDIR)/local-web
	rm -f $(FINDIR)/contrivertext.js

html: $(FINDIR)/doc/html

nonjs: $(FINDIR)/contrivertext

run-nonjs: $(FINDIR)/contrivertext
	$<

run: $(FINDIR)/local-web/contrivertext.js
	$(NODEJS) $<

check-nonjs: $(BUILDDIR)/contrivertext-tests
	$<

check: $(BUILDDIR)/contrivertext-tests.js
	$(NODEJS) $<

