var NODE_FILES = ['./lib/**/*.js', './spec/*.js'];

module.exports = function (grunt) {
  'use strict';

  var JS = '.js';

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  var PROD = grunt.option('production') !== undefined;
  grunt.log.write('Using ' + (PROD ? 'production' : 'development') + ' settings');

  grunt.initConfig({
    jshint: {
      node: {
        options: mergeJSON('.jshintrc', '.jshintrc.node'),
        files: { 
          src: NODE_FILES 
        }
      }
    },
    watch: {
      node_js: {
        files: NODE_FILES,
        tasks: ['jshint']
      }
    }
  });

  grunt.registerTask('default', ['jshint']);
  grunt.registerTask('monitor', ['watch']);


  /*
    Merges all JSON files given as arguments (relative to the current dir).
    Object can be given instead of JSON file path.

    Usage:

      merge('file1', 'file2', 'file3', {a: 1});
  */
  function mergeJSON () {
    var json = [];
    for (var i = 0; i < arguments.length; i++) {
      var arg = arguments[i];
      json.push(typeof arg === 'string' ? grunt.file.readJSON(arguments[i]) : arg);
    }

    return grunt.util._.merge.apply(grunt.util._, json);
  }

};
