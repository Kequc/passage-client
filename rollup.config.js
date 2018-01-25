import commonjs from 'rollup-plugin-commonjs';
import minify from 'rollup-plugin-minify';

export default {
    input: 'index.js',
    output: {
        file: 'dist/passage-client.js',
        format: 'iife',
        name: 'Passage'
    },
    plugins: [
        commonjs(),
        minify({ iife: 'dist/passage-client.min.js' })
    ]
};
