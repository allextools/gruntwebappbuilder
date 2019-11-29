function createUtils (lib, Node) {
  'use strict';

  var Fs = Node.Fs,
    Path = Node.Path;


  function dirContainsProtoboard (dir) {
    return Fs.fileExists(Path.join(dir, 'protoboard.json'));
  }

  function dirIsModuleDir (dir) {
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

  return {
    dirIsModuleDir: dirIsModuleDir,
    nextWalkStep: nextWalkStep
  };
}

module.exports = createNextAssetWalkStep;
