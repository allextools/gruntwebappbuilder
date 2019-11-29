function createOriginalPBCSSAssetsProcessor(lib, OriginalPBAssetsProcessorBase) {
  'use strict';

  function OriginalPBCSSAssetsProcessor(assets, protoboard, pagename, subsectionname) {
    OriginalPBAssetsProcessorBase.call(this, assets, protoboard, pagename);
    this.subsectionName = subsectionname;
  }
  lib.inherit(OriginalPBCSSAssetsProcessor, OriginalPBAssetsProcessorBase);
  OriginalPBCSSAssetsProcessor.prototype.destroy = function () {
    this.subsectionName = null;
    OriginalPBAssetsProcessorBase.prototype.destroy.call(this);
  };
  OriginalPBCSSAssetsProcessor.prototype._takeSource = function () {
    return this.protoboard[this.sectionName][this.subsectionName];
  };
  OriginalPBCSSAssetsProcessor.prototype._assignToTarget = function (result) {
    this.protoboard[this.sectionName][this.subsectionName] = result;
  };
  OriginalPBCSSAssetsProcessor.prototype.sectionName = 'css';

  return OriginalPBCSSAssetsProcessor;
}

module.exports = createOriginalPBCSSAssetsProcessor;
