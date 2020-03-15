// for use with webpack v4
const path = require("path")
const webpack = require("webpack")

const clientConfig = {
    mode: 'production',
    target: "web",
    entry: [
        "./src/ccwt.js",
    ],
    output: {
        filename: "ccwt.js",
        path: path.resolve(__dirname, "demo/dist"),
        libraryTarget: 'umd',
        library: 'CCWT',
        globalObject: `this`
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                include: path.resolve(__dirname, "src"),
                loader: "babel-loader"
            },
            {
                test: /\.wasm$/,
                type: "javascript/auto",
                loader: "file-loader",
                options: {
                  name: "[name].[ext]"
                }
            },
            {
               test: /\.wasm$/,
               loaders: ['wasm-loader']
            }
        ]
    },
    plugins: [
        new webpack.IgnorePlugin(/(fs)/)
    ], // for emscripten build
    watchOptions: {
        ignored: /node_modules/
    },
    cache: true
}

module.exports = [clientConfig]
