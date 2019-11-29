function createOriginalPBAssetsProcessorBase (lib) {
  'use strict';

  function hasComponent (orig, comp) {
    return lib.isEqual(orig, comp);
  }
  function clearDuplicates (arry) {
    var ret = [], _r = ret;
    arry.forEach(function (item) {
      if (!_r.some(hasComponent.bind(null, item))){
        _r.push(item);
      }
      item = null;
    });
    _r = null;
    return ret;
  }

  function OriginalPBAssetsProcessorBase (assets, protoboard, pagename) {
    this.assets = assets;
    this.protoboard = protoboard;
    this.pagename = pagename;
  }
  OriginalPBAssetsProcessorBase.prototype.destroy = function () {
    this.pagename = null;
    this.protoboard = null;
    this.assets = null;
  };
  OriginalPBAssetsProcessorBase.prototype.go = function () {
    var ret;
    this._assignToTarget(clearDuplicates(
      this._resolveReferences(this._takeSource())
        .reduce(this._processAsset.bind(this), [])
      )
    );
    ret = this._resultOfGo();
    this.destroy();
    return ret;
  };
  OriginalPBAssetsProcessorBase.prototype._resolveReferences = function (assets) {
    this._checkForAssets();
    return this.assets.reader.resolveReferences(assets, this.pagename);
  };
  OriginalPBAssetsProcessorBase.prototype._processAsset = function (result, record) {
    this._checkForAssets();
    this._handleProcessedAsset(result, this.assets._processAsset(this.sectionName, record));
    return result;
  };

  OriginalPBAssetsProcessorBase.prototype._checkForAssets = function () {
    if (!this.assets) {
      throw new Error (this.constructor.name+' has got no assets');
    }
  };

  OriginalPBAssetsProcessorBase.prototype._handleProcessedAsset = function (result, procasset) {
    procasset.forEach(this.assets.reader.conditionalAddToComponent.bind(this.assets.reader));
    Array.prototype.push.apply(result, procasset);
  };

  OriginalPBAssetsProcessorBase.prototype._takeSource = function () {
    return this.protoboard[this.sectionName];
  };

  OriginalPBAssetsProcessorBase.prototype._assignToTarget = function (result) {
    this.protoboard[this.sectionName] = result;
  };

  OriginalPBAssetsProcessorBase.prototype._resultOfGo = function () {
    return true;
  };

  return OriginalPBAssetsProcessorBase;
}

module.exports = createOriginalPBAssetsProcessorBase;
