function createUtils (lib, Node) {
  'use strict';

  var Fs = Node.Fs,
    Path = Node.Path;

  function absolutizePath(root, path) {
    return Path.isAbsolute(path) ? path : Path.resolve(root, path);
  }

  function tryBowerForIncludes (includes, dir) {
    var cwdbower, cwdbower_rc, td;
    cwdbower = Path.resolve(dir,'bower_components');
    cwdbower_rc = Path.resolve(dir, '.bowerrc');

    if (Fs.fileExists(cwdbower_rc)) {
      td = Fs.readFieldFromJSONFile(cwdbower_rc, 'directory');
      if (td) cwdbower = td;
    }

    if (cwdbower) {
      includes.push(cwdbower);
    }
    return cwdbower;
  };

  function tryNpmForIncludes (includes, dir) {
    //TODO: try .npmrc 
    var pjpath, cwdnm;
    pjpath = Path.resolve(dir, 'package.json');
    cwdnm = Path.resolve(dir,'node_modules');

    if (!Fs.fileExists(pjpath)) {
      return;
    }

    if (cwdnm) {
      includes.push(cwdnm);
    }
    return cwdnm;
  };


  return {
    tryBowerForIncludes: tryBowerForIncludes,
    tryNpmForIncludes: tryNpmForIncludes
  };
}

module.exports = createUtils;
