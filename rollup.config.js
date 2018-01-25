import babel from 'rollup-plugin-babel';
import minify from 'rollup-plugin-minify';

export default {
    input: 'src/passage-client.js',
    output: {
        file: 'dist/passage-client.js',
        format: 'iife',
        name: 'Passage'
    },
    plugins: [
        babel(),
        minify({ iife: 'dist/passage-client.min.js' })
    ]
};
