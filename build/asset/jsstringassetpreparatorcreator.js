function createJSStringAssetPreparator (lib, Node, StringAssetPreparator, factory) {
  'use strict';

  var Path = Node.Path;

  function JSStringAssetPreparator (reader, assetstring) {
    StringAssetPreparator.call(this, reader, assetstring);
  }
  lib.inherit(JSStringAssetPreparator, StringAssetPreparator);
  JSStringAssetPreparator.prototype.searchGroup = 'js';
  JSStringAssetPreparator.prototype.handleActualTarget = function (maybestep) {
    this.assetpath = this.protoboard.actualtarget.slice();
    this.destpath = this.walkpath.slice(1).concat(this.assetpath);
    return this.assetpath.shift();
  };
  JSStringAssetPreparator.prototype.finalReturnProc = function (myret) {
    var ret = {js:[], css:[]};
    if (this.protoboard && this.protoboard.dependencies) {
      lib.traverseShallow(this.protoboard.dependencies, this.dependencyTraverser.bind(this, ret));
    };
    if (this.protoboard && this.protoboard.additionaltargets) {
      lib.traverseShallow(this.protoboard.additionaltargets, this.additionalTargetTraverser.bind(this, ret));
    };
    if (!(this.searchGroup in ret)) {
      ret[this.searchGroup] = [];
    }
    ret[this.searchGroup].push(myret);
    return ret;
  };
  JSStringAssetPreparator.prototype.dependencyTraverser = function (ret, deps, group) {
    deps.reduce(this.digDependency.bind(this, false, group), ret);
  };
  JSStringAssetPreparator.prototype.digDependency = function (straightforward, group, result, dep) {
    var r, _res;
    r = (factory(this.reader, dep, group, straightforward)).go();
    if (lib.isArray(r)) {
      pusher(result[group], r);
      return result;
    }
    _res = result;
    lib.traverseShallow(r, travpusher.bind(null, _res));
    _res = null;
    return result;
  };
  function pusher (a1, a2) {
    Array.prototype.push.apply(a1, a2);
  }
  function travpusher (result, arry, name) {
    pusher(result[name], arry);
  }

  JSStringAssetPreparator.prototype.additionalTargetTraverser = function (ret, deps, group) {
    deps.reduce(this.digAdditionalTarget.bind(this, group), ret);
  };
  JSStringAssetPreparator.prototype.digAdditionalTarget = function (group, result, dep) {
    return this.digDependency(true, group, result, Path.join(Path.join.apply(Path, this.moduledistpath), Path.join(Path.join.apply(Path, dep))));
  };
  return JSStringAssetPreparator;
}

module.exports = createJSStringAssetPreparator;
