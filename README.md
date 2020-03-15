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
require('ccwt.js')

CCWT.onReady = function () {
    // CCWT.frequencyBand
    // CCWT.fft1d
    // CCWT.numericOutput
    // see demo/index.html :)
}
```

## Browser

See `demo/index.html`

## Documentation

First register a ready callback to `CCWT.onReady`, it will fire once the library is initialized

Then there is only 3 functions needed :

`CCWT.frequencyBand` which will generate the frequency map and will be used by `numericOutput`

`CCWT.fft1d` which will produce the transformed fourier signal of input data, result will be passed to `numericOutput`

`CCWT.numericOutput` which will generate each rows complex data and call the user provided row callback which will receive the row index, raw complex data and associated padding

`CCWT.numericOutput` accept a start_y / end_y argument so parallelization via a worker can be easily done by splitting spectogram height

The provided example `demo/index.html` has everything needed to generate a linear or logarithmic audio spectogram (default) in a web browser and its row callback can be used as a basis

All usable CCWT functions in `src/ccwt.js` are documented using JSDoc

The [original tutorial](https://github.com/Lichtso/CCWT/wiki/Tutorial) can also help (note : functions name are the same but arguments orders aren't)
