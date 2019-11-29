function createCSSStringAssetPreparator (lib, StraightForwardStringAssetPreparatorBase) {
  'use strict';

  function CSSStringAssetPreparator (reader, assetstring) {
    StraightForwardStringAssetPreparatorBase.call(this, reader, assetstring);
  }
  lib.inherit(CSSStringAssetPreparator, StraightForwardStringAssetPreparatorBase);
  CSSStringAssetPreparator.prototype.searchGroup = 'css';

  return CSSStringAssetPreparator;
}

module.exports = createCSSStringAssetPreparator;
