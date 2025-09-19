#!/bin/bash
# Increment et publish automatique

# Version avec timestamp
VERSION="0.0.1-dev.$(date +%s)"

# Update package.json
npm version $VERSION --no-git-tag-version

# Publish avec tag dev
npm publish --tag dev

echo "Published crimsonquill@$VERSION"
echo "Install with: npm install crimsonquill@dev"
