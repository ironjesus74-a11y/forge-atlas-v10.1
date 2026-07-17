#!/usr/bin/env bash
set -Eeuo pipefail

rm -rf dist
mkdir -p dist

cp -a \
  *.html \
  *.css \
  *.js \
  public \
  favicon.svg \
  opengraph.jpg \
  robots.txt \
  sitemap.xml \
  _headers \
  _redirects \
  dist/

test -f dist/index.html
test -f dist/swarm.html
test -f dist/public/js/emery.js
test -f dist/public/css/emery.css
grep -qi 'Built Different' dist/index.html

printf 'Static Pages build complete: %s files\n' "$(find dist -type f | wc -l)"
