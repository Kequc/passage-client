import commonjs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';

export default {
    input: 'index.js',
    output: {
        file: 'dist/passage-client.min.js',
        format: 'iife',
        name: 'Passage'
    },
    plugins: [
        commonjs(),
        uglify()
    ]
};
