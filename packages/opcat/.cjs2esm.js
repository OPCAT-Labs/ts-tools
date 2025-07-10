module.exports = {
  input: ['cjs'],
  ignore: [],
  output: 'esm',
  forceDirectory: null,
  modules: [],
  extension: {
    use: 'js',
    ignore: [],
  },
  addModuleEntry: false,
  addPackageJson: true,
  filesWithShebang: [],
  codemod: {
    path: '',
    files: ['cjs', 'exports'],
  },
};