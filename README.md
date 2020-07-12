# ccwt.js
Javascript port of the [CCWT](https://github.com/Lichtso/CCWT) library

This can be used to produce high frequency / time resolution spectogram such as

![spectrogram](https://raw.githubusercontent.com/Lichtso/CCWT/gallery/teaser.png)

Can be used directly in the browser by including `demo/dist/ccwt.js` file `demo/dist/FFTW.wasm` file is also needed in the same directory as `ccwt.js` file

## Features

Complex [continuous wavelet transformation](https://en.wikipedia.org/wiki/Continuous_wavelet_transform)

- fast Javascript port of [CCWT](https://github.com/Lichtso/CCWT) library
- with a [gabor wavelet](https://en.wikipedia.org/wiki/Gabor_wavelet)
- use [fftw-js](https://github.com/dean-shaff/fftw-js) library which is extended from [fftw-js](https://github.com/j-funk/fftw-js) library which is an Emscripten FFTW port 
- parallelization ready (by splitting height into chunks then feeding workers)
- customizable frequency bands
- full example with linear / exponential frequency bands

This does not have the original render modes (real, imaginary, phase, equipotential and rainbow) bundled as it focus on the CCWT part (rendering is externalized and is handled on user side via a callback) but the provided example do amplitude rendering (linear or logarithmic) and it can be extended easily to the other modes

## Build

`npm install`
`npm run build`

The built production file is `demo/dist/ccwt.js`

Run the demo in default browser (which will use `http-server` to avoid CORS issues) :

`npm run demo`

## Usage

### Node

`npm install ccwt.js --save`

```js
const CCWT = require('ccwt.js')

CCWT.then((ccwt_lib) => {
    // ccwt_lib.frequencyBand
    // ccwt_lib.fft1d
    // ccwt_lib.numericOutput
    // see demo/index.html :)
});
```

## Browser

See `demo/index.html`

## Documentation

Include the library file `ccwt.js`, the web version define a `CCWT` symbol globally which is a promise (which load the FFTW .wasm file) which when resolved return the CCWT library object where all functions are defined.

Then there is only 3 functions needed :

`CCWT.frequencyBand` which will generate the frequency map and will be used by `numericOutput`

`CCWT.fft1d` which will produce the transformed fourier signal of input data, result will be passed to `numericOutput`

`CCWT.numericOutput` which will generate each rows complex data and call the user provided row callback which will receive the row index, raw complex data and associated padding

`CCWT.numericOutput` accept a start_y / end_y argument so parallelization via a worker can be easily done by splitting spectogram height

The provided example `demo/index.html` has everything needed to generate a linear or logarithmic audio spectogram (default) in a web browser and its row callback can be used as a basis

All usable CCWT functions in `src/ccwt.js` are documented using JSDoc

The [original tutorial](https://github.com/Lichtso/CCWT/wiki/Tutorial) can also help (note : functions name are the same but arguments orders aren't)

## fftw-js

This library use a modified [fftw-js](https://github.com/dean-shaff/fftw-js) library which is a Javascript port via Emscripten of the FFTW library.

The modifications include :

* compiled with Emscripten 1.39.17 (latest right now)
* compiled with `-s ALLOW_MEMORY_GROWTH=1` to allow arbitrary files length analysis

There is also a small modification of the glue code to silence warnings related to errno.

Note : The original `Makefile.emscripten` of the fftw-js library had to be modified a bit to produce a correct build, here are the options used : 

```bash
OPTIONS=--memory-init-file 0 \
                                 -s FILESYSTEM=0 \
                                 -s PRECISE_F32=1 \
                                 -s MODULARIZE=1 \
                                 -s WASM=1 \
                                 -s ALLOW_MEMORY_GROWTH=1 \
                                 -s EXPORT_NAME="'FFTWModule'" \
                                 -s EXPORTED_FUNCTIONS=$(EXPORTED_FUNCTIONS) \
                                 -s "EXTRA_EXPORTED_RUNTIME_METHODS=['ccall', 'cwrap']"

```