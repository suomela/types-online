# types-online

Measures of productivity and diversity

## Setup

This tool supports the same file format as types2:
https://jukkasuomela.fi/types2/

You can simply copy the following files to a web server:

- file `types-data.js` from types2
- all files in the subdirectory `src`

## Third-party assets

The directory `src/vendor` contains vendored copies of D3, normalize.css, and
Milligram so that deployments do not depend on external CDNs at runtime. These
files retain their upstream licenses and copyright notices; see
`src/vendor/LICENSES.md`.
