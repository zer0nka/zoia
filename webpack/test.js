const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");
const babelConfig = require("./babel.config");

module.exports = (argv) => ({
    name: "Test Part",
    context: path.resolve(`${__dirname}/../${argv.type === "update" ? "update" : "src"}/shared/test`),
    resolve: {
        extensions: [".js", ".json"]
    },
    module: {
        rules: [argv.mode === "production" ? {
            test: /\.js$/,
            exclude: /node_modules/,
            loader: "babel-loader",
            options: babelConfig()
        } : {}]
    },
    target: "node",
    externals: [/^[^./!]/],
    optimization: argv.mode === "production" ? {
        splitChunks: false,
        minimizer: [
            new TerserPlugin({
                cache: true,
                parallel: true,
                sourceMap: false,
                extractComments: false,
            })
        ]
    } : {},
    output: {
        libraryTarget: "commonjs2",
        path: path.resolve(`${__dirname}/../build/bin`),
        filename: argv.type === "update" ? "test_update.js" : "test.js",
        publicPath: `/zoia/`,
    },
    node: {
        __dirname: false
    },
    plugins: [
        new webpack.DefinePlugin({
            "process.browser": undefined,
            "process.env.BUNDLE": true
        }),
        new webpack.optimize.LimitChunkCountPlugin({
            maxChunks: 1
        })
    ]
});
