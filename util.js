function createUtil (lib, Node, ModuleRecognizerSync) {
  'use strict';

  var Path = Node.Path;

  function recognizeModule (string, installobj) {
    var asset = ModuleRecognizerSync(string);
    if (!lib.isString(asset)) {
      if (!asset) {
        console.log('wut?', string, '=>', asset);
        console.trace();
        process.exit(1);
      }
      if (!asset.modulename) {
        throw 'After Allex module recognition, the resulting object has to have a modulename';
      }
      if (asset.npmstring !== asset.modulename && installobj && 'object' === typeof installobj) {
        if (!installobj.installResolution) {
          installobj.installResolution = {};
        }
        installobj.installResolution[asset.modulename] = asset.npmstring;
      }
      asset = Path.join('node_modules', asset.modulename, 'dist', 'browserified.js');
    } else {
      if (asset &&
        asset.indexOf(':')>0 &&
        asset.indexOf('/')<0 &&
        asset.indexOf('\\')<0
      ) {
        throw new Error ('Module recognition for '+string+' resulted in '+asset+', it is very likely that your .allexns.json needs updating');
      }
    }
    return asset;
  }

  return {
    recognizeModule: recognizeModule
  };
}

module.exports = createUtil;
