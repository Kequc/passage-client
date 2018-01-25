import babel from 'rollup-plugin-babel';
import minify from 'rollup-plugin-minify';

export default {
    input: 'src/passage.js',
    output: {
        file: 'dist/passage.js',
        format: 'iife',
        name: 'Passage'
    },
    plugins: [
        babel(),
        minify({ iife: 'dist/passage.min.js' })
    ]
};
