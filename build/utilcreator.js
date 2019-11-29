function createUtils (lib, Node) {
  'use strict';

  var Fs = Node.Fs,
    Path = Node.Path;

  function absolutizePath(root, path) {
    return Path.isAbsolute(path) ? path : Path.resolve(root, path);
  }

  return {
    absolutizePath: absolutizePath,
  };
}

module.exports = createUtils;
