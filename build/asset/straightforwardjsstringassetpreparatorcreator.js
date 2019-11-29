function createStraightForwardJSStringAssetPreparator (lib, StraightForwardStringAssetPreparatorBase) {
  'use strict';

  function StraightForwardJSStringAssetPreparator (reader, assetstring) {
    StraightForwardStringAssetPreparatorBase.call(this, reader, assetstring);
  }
  lib.inherit(StraightForwardJSStringAssetPreparator, StraightForwardStringAssetPreparatorBase);
  StraightForwardJSStringAssetPreparator.prototype.searchGroup = 'js';

  return StraightForwardJSStringAssetPreparator;
}

module.exports = createStraightForwardJSStringAssetPreparator;
