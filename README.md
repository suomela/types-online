# types-online

Measures of productivity and diversity

`types-online` is a static browser application for plotting accumulation curves
from a `types2` data file. It repeatedly randomizes the order of corpus samples,
accumulates the samples one by one, and plots how productivity and diversity
measures change as the accumulated corpus grows.

## Setup

This tool supports the same file format as types2:
https://jukkasuomela.fi/types2/

You can simply copy the following files to a web server:

- file `types-data.js` from types2
- all files in the subdirectory `src`

The page uses browser Web Workers, so serve it over HTTP(S), or with a local
static web server during development. Opening `index.html` directly from the
filesystem may not work in all browsers.

## Data used by the app

The app expects `types-data.js` to call `types.data(db)`. The current frontend
uses these parts of the `types2` database:

- `db.corpus[corpusCode]`: available corpora
- `db.dataset[corpusCode][datasetCode]`: available datasets within a corpus
- `db.collection[corpusCode][collectionCode]`: available subcorpora
- `db.sample[corpusCode][sampleCode].wordcount`: running-word count for each
  sample
- `db.sample_collection[corpusCode][collectionCode]`: sample codes that belong
  to a subcorpus
- `db.token[corpusCode][datasetCode][sampleCode][tokenCode].tokencount`: counts
  for each token/type code in each sample

A dataset defines which token/type codes are counted. For example, one dataset
might contain all words, while another might contain only a particular part of
speech or morphological class. In this app, a "type" is a distinct `tokenCode`
in the selected dataset, and a "token" is one occurrence counted in the selected
dataset.

## How plots are calculated

For each selected corpus and dataset, the worker repeatedly shuffles the
selected samples. For each shuffled order, it accumulates samples from left to
right and records one point after each added sample.

For a given accumulated prefix of samples, define:

- `c_t`: accumulated count of token/type code `t` in the selected dataset
- `T = sum_t c_t`: accumulated token count in the selected dataset
- `W`: accumulated `sample.wordcount`, i.e. running words
- `V = count of t where c_t > 0`: accumulated type count
- `H = count of t where c_t == 1`: accumulated hapax count
- `p_t = c_t / T` for all `t` with `c_t > 0`

The X axis can be either:

- `running words`: `W`
- `tokens`: `T`

The main curve uses all samples in the selected corpus. If a collection is
selected, a second curve is calculated for only the samples in that collection
and drawn on top of the main curve.

The worker keeps updating the plot as more random permutations are calculated,
up to 100,000 permutations per selected curve. The shaded bands are empirical
quantile bands across the random permutations. The displayed levels are
0.0001/0.9999, 0.001/0.999, 0.01/0.99, and 0.1/0.9, with the median curve in
the middle.

## Y axis options

All Y-axis options are calculated from the accumulated samples at each X-axis
position.

### `types`

The number of distinct token/type codes seen so far:

```text
V = count of t where c_t > 0
```

This is vocabulary size or type richness for the selected dataset.

### `hapaxes`

The number of token/type codes that have occurred exactly once so far:

```text
H = count of t where c_t == 1
```

This counts accumulated hapax legomena in the selected dataset.

### `tokens`

The total number of token occurrences seen so far in the selected dataset:

```text
T = sum_t c_t
```

This differs from `running words` when the selected dataset is a subset of the
corpus, such as only nouns or only adjectives.

### `Yule's K`

Yule's K calculated from the accumulated token/type counts:

```text
if T == 0:
    K = 0
else:
    K = 10000 * (sum_t c_t^2 - T) / T^2
```

The `10000` factor is the conventional scaling factor. Larger values indicate
more concentration in repeated types; lower values indicate more even or diverse
use of types.

### `2nd order entropy`

Second-order Renyi entropy, also called collision entropy, calculated from the
accumulated token/type probabilities:

```text
if T == 0:
    H_2 = 0
else:
    H_2 = -log2(sum_t p_t^2)
```

This is measured in bits. It is lower when the distribution is dominated by a
few frequent types and higher when counts are spread more evenly across many
types.

### `entropy`

Shannon entropy calculated from the accumulated token/type probabilities:

```text
if T == 0:
    H = 0
else:
    H = -sum_t p_t * log2(p_t)
```

This is measured in bits. Higher values indicate a more diverse or less
predictable distribution of token/type codes.

## Third-party assets

The directory `src/vendor` contains vendored copies of D3, normalize.css, and
Milligram so that deployments do not depend on external CDNs at runtime. These
files retain their upstream licenses and copyright notices; see
`src/vendor/LICENSES.md`.
