function createStraightForwardStringAssetPreparatorBase (lib, StringAssetPreparator) {
  'use strict';

  function StraightForwardStringAssetPreparatorBase (reader, assetstring) {
    StringAssetPreparator.call(this, reader, assetstring);
  }
  lib.inherit(StraightForwardStringAssetPreparatorBase, StringAssetPreparator);
  StraightForwardStringAssetPreparatorBase.prototype.handleActualTarget = function (maybestep) {
    return maybestep;
  };
  StraightForwardStringAssetPreparatorBase.prototype.finalReturnProc = function (myret) {
    return [myret];
  };

  return StraightForwardStringAssetPreparatorBase;
}

module.exports = createStraightForwardStringAssetPreparatorBase;
