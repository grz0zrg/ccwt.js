/*
 * ported from https://github.com/Lichtso/CCWT
 * use fftw-js : https://github.com/dean-shaff/fftw-js
 */

const fftw_runtime = require('./fftw/FFTW.js')()

// FFTW flags
const FFTW_FORWARD = -1
const FFTW_BACKWARD = 1

const FFTW_MEASURE = 0
const FFTW_ESTIMATE = (1 << 6)

const CCWT = {
    onReady: null
}

fftw_runtime.onRuntimeInitialized = () => {
    // initialize fftw functions
    const fftwf_plan_dft_r2c_1d = fftw_runtime.cwrap('fftwf_plan_dft_r2c_1d', 'number', ['number', 'number', 'number', 'number'])

    // fftw_plan fftw_plan_dft_1d(int n, fftw_complex *in, fftw_complex *out,
    //                            int sign, unsigned flags)
    const fftwf_plan_dft_1d = fftw_runtime.cwrap('fftwf_plan_dft_1d', 'number', ['number', 'number', 'number', 'number', 'number'])

    const fftwf_execute = fftw_runtime.cwrap('fftwf_execute', 'void', ['number'])

    //const fftwf_execute_dft = fftw_runtime.cwrap('fftwf_execute_dft', 'void', ['number', 'number', 'number'])

    const fftwf_destroy_plan = fftw_runtime.cwrap('fftwf_destroy_plan', 'void', ['number'])

    const fftwf_free = fftw_runtime.cwrap('fftwf_free', 'void', ['number'])

    const fftwf_malloc = fftw_runtime.cwrap('fftwf_malloc', 'number', ['number'])

    /**
     * Compute forward 1d fft
     * 
     * @param {Float32Array} input source signal data
     * @param {number} padding amount of padding to add to the signal (get rid of oddities due to signal ends)
     * @param {number} input_gain signal gain amount to apply before transform
     * @return {Float32Array} resulting fourier transformed signal eg. [real, imag...]
     */
    CCWT.fft1d = (input, padding, input_gain) => {
        const input_length = input.length
        const input_sample_count = input_length + 2 * padding

        const input_ptr = fftwf_malloc(2 * 4 * input_sample_count)
        const output_ptr = fftwf_malloc(2 * 4 * input_sample_count)

        const inputc = new Float32Array(fftw_runtime.HEAPU8.buffer, input_ptr, input_sample_count * 2)
        const output = new Float32Array(fftw_runtime.HEAPU8.buffer, output_ptr, input_sample_count * 2)

        let i = 0
        for (i = 0; i < padding; ++i) {
            inputc[i] = inputc[input_sample_count - i - 1] = 0.0
        }

        const input_type_factor = 2
        for (i = 0; i < input_length; ++i) {
            inputc[padding * 2 + i] = input[i] * input_type_factor * input_gain
        }

        for (i = input_sample_count; i < input_sample_count * 2; ++i) {
            inputc[i] = 0
        }

        const input_plan = fftwf_plan_dft_r2c_1d(input_sample_count, input_ptr, output_ptr, FFTW_ESTIMATE)

        fftwf_execute(input_plan)

        fftwf_destroy_plan(input_plan)
        fftwf_free(input_ptr)
        fftwf_free(output_ptr)

        return output
    }

    /**
     * Generate custom frequency band; first column are the frequencies and the second their derivatives
     * 
     * @param {number} band_length length of frequency band
     * @param {number} frequency_range frequencies range
     * @param {number} frequency_offset base frequency
     * @param {number} frequency_basis > 0.0 to generate exponential frequency band
     * @param {number} deviation frequency / time resolution (values near zero have better frequency resolution, values towards infinity have better time resolution, 1 is a good tradeoff)
     * @return {Float32Array} generated frequency band
     */
    CCWT.frequencyBand = (band_length, frequency_range, frequency_offset, frequency_basis, deviation) => {
        const frequency_band = new Float32Array(band_length * 2)

        deviation *= Math.sqrt(1.0 / (4.0 * Math.PI))

        if (frequency_range == 0.0) {
            frequency_range = band_length / 2
        }

        let y = 0
        for (y = 0; y < band_length; ++y) {
            let frequency = frequency_range * (1.0 - y / band_length) + frequency_offset
            let frequency_derivative = frequency_range / band_length

            if (frequency_basis > 0.0) {
                frequency = Math.pow(frequency_basis, frequency)
                frequency_derivative *= Math.log(frequency_basis) * frequency
            }

            frequency_band[y * 2] = frequency
            frequency_band[y * 2 + 1] = frequency_derivative * deviation
        }

        return frequency_band
    }

    /**
     * @param {Float32Array} input_transformed_signal fourier transformed signal from fft1d result eg. [real, imag...]
     * @param {number} padding amount of padding in the signal
     * @param {Float32Array} frequency_band frequency band from frequencyBand function
     * @param {number} start_y when to start (typically used to split workload otherwise can be 0)
     * @param {number} end_y when to end (typically used with start_y to split workload)
     * @param {output_width} output_width row width
     * @param {function} row_callback function to be called when a row is done, it contain vertical position, output data (Float32Array of complex) and computed output padding as argument
     */
    CCWT.numericOutput = (input_transformed_signal, padding, frequency_band, start_y, end_y, output_width, row_callback) => {
        const input_sample_count = input_transformed_signal.length / 2

        const input_width = input_sample_count - 2 * padding
        const output_sample_count = output_width * (input_sample_count / input_width)

        if (output_width === 0) {
            output_width = input_width
        }

        if (output_width > input_width) {
            return -2
        }

        const input_ptr = fftwf_malloc(2 * 4 * output_sample_count)
        const output_ptr = fftwf_malloc(2 * 4 * output_sample_count)
        // TODO: handle malloc fails ?

        const input = new Float32Array(fftw_runtime.HEAPU8.buffer, input_ptr, 2 * output_sample_count)
        const output = new Float32Array(fftw_runtime.HEAPU8.buffer, output_ptr, 2 * output_sample_count)

        const fftw_plan = fftwf_plan_dft_1d(output_sample_count, input_ptr, output_ptr, FFTW_BACKWARD, FFTW_MEASURE)

        // compute
        const half_input_sample_count = input_sample_count >> 1
        const scale_factor = 1.0 / input_sample_count
        const padding_correction = input_sample_count / input_width

        let y = 0
        for (y = start_y; y < end_y; ++y) {
            const frequency = frequency_band[y * 2] * padding_correction
            const deviation = 1.0 / (frequency_band[y * 2 + 1] * output_sample_count * padding_correction)

            let i = 0
            for (i = 0; i < output_sample_count; ++i) {
                // ccwt_gabor_wavelet(i)
                const f = half_input_sample_count - Math.abs(Math.abs(i - frequency) - half_input_sample_count)
                let input_real = input_transformed_signal[i * 2]
                let input_imag = input_transformed_signal[i * 2 + 1]
                const d = Math.exp(-f * f * deviation)
                input_real *= d * scale_factor
                input_imag *= d * scale_factor

                //let input_cmp = window.math.complex(input_transformed_signal[i * 2], input_transformed_signal[i * 2 + 1])
                //input_cmp = window.math.multiply(Math.exp(-f * f * deviation), input_cmp)
                //input_cmp = window.math.multiply(input_cmp, scale_factor)
                input[i * 2] =  input_real // window.math.re(input_cmp)
                input[i * 2 + 1] = input_imag // window.math.im(input_cmp)
                //
            }

            if (output_sample_count < input_sample_count) {
                const rest = input_sample_count % output_sample_count
                const cut_index = input_sample_count - rest
                
                let chunk_index = 0
                for (chunk_index = output_sample_count; chunk_index < cut_index; chunk_index += output_sample_count) {
                    let j = 0
                    for (j = 0; j < output_sample_count; ++j) {
                        let index = chunk_index + j
                        let index2 = chunk_index * 2 + j * 2
                        // ccwt_gabor_wavelet(index)
                        const f2 = half_input_sample_count - Math.abs(Math.abs(index - frequency) - half_input_sample_count)
                        let input_real = input_transformed_signal[index2]
                        let input_imag = input_transformed_signal[index2 + 1]
                        const d = Math.exp(-f2 * f2 * deviation)
                        input_real *= d * scale_factor
                        input_imag *= d * scale_factor
                        let output_real = input[j * 2] + input_real
                        let output_imag = input[j * 2 + 1] + input_imag

                        //input_cmp = window.math.complex(input_transformed_signal[index2], input_transformed_signal[index2 + 1])
                        //input_cmp = window.math.multiply(Math.exp(-f2 * f2 * deviation), input_cmp)
                        //input_cmp = window.math.multiply(input_cmp, scale_factor)
                        //let output_cmp = window.math.complex(input[j * 2], input[j * 2 + 1])
                        //output_cmp = window.math.add(output_cmp, input_cmp)

                        input[j * 2] = output_real // window.math.re(output_cmp)
                        input[j * 2 + 1] = output_imag // window.math.im(output_cmp)
                        //
                    }
                }
                let k = 0
                for (k = 0; k < rest; ++k) {
                    let index = cut_index + k
                    let index2 = cut_index * 2 + k * 2
                    // ccwt_gabor_wavelet(index)
                    const f2 = half_input_sample_count - Math.abs(Math.abs(index - frequency) - half_input_sample_count)
                    let input_real = input_transformed_signal[index2]
                    let input_imag = input_transformed_signal[index2 + 1]
                    const d = Math.exp(-f2 * f2 * deviation)
                    input_real *= d * scale_factor
                    input_imag *= d * scale_factor
                    let output_real = input[k * 2] + input_real
                    let output_imag = input[k * 2 + 1] + input_imag

                    //input_cmp = window.math.complex(input_transformed_signal[index2], input_transformed_signal[index2 + 1])
                    //input_cmp = window.math.multiply(Math.exp(-f2 * f2 * deviation), input_cmp)
                    //input_cmp = window.math.multiply(input_cmp, scale_factor)
                    //let output_cmp = window.math.complex(input[k * 2], input[k * 2 + 1])
                    //output_cmp = window.math.add(output_cmp, input_cmp)

                    input[k * 2] = output_real // window.math.re(output_cmp)
                    input[k * 2 + 1] = output_imag // window.math.im(output_cmp)
                    //
                }
            }

            fftwf_execute(fftw_plan)

            row_callback(y, output, padding * (output_width / input_width))
        }

        fftwf_destroy_plan(fftw_plan)
        
        fftwf_free(input_ptr)
        fftwf_free(output_ptr)

        return 0
    }

    if (CCWT.onReady !== null) {
        CCWT.onReady()
    } else {
        console.log("ccwt.js : unregistered onReady callback")
    }
}

module.exports = CCWT