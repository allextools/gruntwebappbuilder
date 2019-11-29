function createUtils (lib, Node) {
  'use strict';

  var Fs = Node.Fs,
    Path = Node.Path;

  function protoboardPath (dir) {
    return Path.join(dir, 'protoboard.json');
  }

  function dirContainsProtoboard (dir) {
    return Fs.fileExists(protoboardPath(dir));
  }

  function dirIsModuleDirByPackageJson (dir) {
    var pjname = Path.join(dir, 'package.json'), pj;
    if (!Fs.fileExists(pjname)) {
      return false;
    }
    try {
      pj = JSON.parse(Fs.readFileSync(pjname).toString());
      return pj.name === Path.basename(dir);
    }
    catch (e) {
      return false;
    }
  }

  function dirIsModuleDirByBowerJson (dir) {
    var bowername = Path.join(dir, 'bower.json'), bower;
    if (!Fs.fileExists(bowername)) {
      return false;
    }
    try {
      bower = JSON.parse(Fs.readFileSync(bowername).toString());
      return bower.name === Path.basename(dir);
    }
    catch (e) {
      return false;
    }
  }
  function dirIsModuleDir (dir) {
    return dirIsModuleDirByPackageJson(dir) /**/ || dirIsModuleDirByBowerJson(dir);
  }

  function subdirContainer (rootdir, result, dir) {
    var dirpath = Path.join(rootdir, dir);
    if (!Fs.dirExists(dirpath)) {
      return result;
    }
    if (!dirContainsProtoboard(dirpath)) {
      return result;
    }
    return dir;
  }

  function findProtoboardContainingDirIn (dir) {
    return Fs.readdirSync(dir).reduce(subdirContainer.bind(null, dir), '') || dir;
  }

  function nextWalkStep (dir) {
    if (Fs.dirExists(dir)) {
      return dir;
    }
    if (Fs.fileExists(dir)) {
      return dir;
    }
    if (dirIsModuleDir(process.cwd())) {
      return findProtoboardContainingDirIn (process.cwd());
    }
    return dir;
  }

  function protoboardAt (dir) {
    var cont = null;
    if (!dirContainsProtoboard(dir)) {
      return null;
    }
    try {
      cont = JSON.parse(Fs.readFileSync(protoboardPath(dir)));
    }catch(e){}
    return cont;
  }

  return {
    dirIsModuleDir: dirIsModuleDir,
    nextWalkStep: nextWalkStep,
    protoboardAt: protoboardAt
  };
}

module.exports = createUtils;
