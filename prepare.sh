#!/bin/bash

distFolder="./dist/"
cp -r assets ./${distFolder}
cp -r drivers ./${distFolder}
cp -r lib ./${distFolder}
cp -r locales ./${distFolder}
cp -r settings ./${distFolder}
cp .homeyignore ./${distFolder}
cp .homeyplugins.json ./${distFolder}
cp app.js ./${distFolder}
cp app.json ./${distFolder}
cp CODE_OF_CONDUCT.md ./${distFolder}
cp LICENSE ./${distFolder}
cp package.json ./${distFolder}
cp package-lock.json ./${distFolder}
cp README.md ./${distFolder}
