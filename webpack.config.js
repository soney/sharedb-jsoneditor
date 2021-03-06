const path = require('path');

module.exports = {
    entry: './src/index.ts',
    module: {
        rules: [ {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        }],
    },
    devtool: "source-map",
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ],
    },
    output: {
        filename: 'sharedb-jsoneditor.js',
        path: path.resolve(__dirname, 'dist'),
        libraryExport: 'default',
        library: 'ShareDBJSONEditor',
        libraryTarget: 'umd'
    },
    externals: {
        // 'jsoneditor': 'JSONEditor'
    }
};