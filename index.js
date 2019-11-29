function createLib (lib) {
  'use strict';

  var Node = require('allex_nodehelpersserverruntimelib')(lib),
    ModuleRecognizerSync = require('allexmodulerecognitionsync'),
    Protoboard = require('allex_protoboardhelperssdklib')(lib),
    util = require('./util')(lib, Node, ModuleRecognizerSync);

  return {
    create: require('./create')(lib, Node),
    add: require('./add')(lib, Node, Protoboard),
    build: require('./build')(lib, Node, util),
    compile: require('./compile')(lib, Node, util.recognizeModule)
  };
}

module.exports = createLib;
