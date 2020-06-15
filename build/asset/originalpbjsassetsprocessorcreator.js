function createOriginalPBJSAssetsProcessor(lib, OriginalPBAssetsProcessorBase) {
  'use strict';

  function OriginalPBJSAssetsProcessor(assets, protoboard, pagename) {
    OriginalPBAssetsProcessorBase.call(this, assets, protoboard, pagename);
    this.depCSSs = [];
  }
  lib.inherit(OriginalPBJSAssetsProcessor, OriginalPBAssetsProcessorBase);
  OriginalPBJSAssetsProcessor.prototype.destroy = function () {
    this.depCSSs = null;
    OriginalPBAssetsProcessorBase.prototype.destroy.call(this);
  };
  OriginalPBJSAssetsProcessor.prototype._handleProcessedAsset = function (result, procasset) {
    Array.prototype.push.apply(this.depCSSs, procasset.css);
    return OriginalPBAssetsProcessorBase.prototype._handleProcessedAsset.call(this, result, procasset.js);
  };
  OriginalPBJSAssetsProcessor.prototype._resultOfGo = function () {
    return this.clearDuplicates(this.depCSSs);
  }
  OriginalPBJSAssetsProcessor.prototype.sectionName = 'js';


  return OriginalPBJSAssetsProcessor;
}

module.exports = createOriginalPBJSAssetsProcessor;
