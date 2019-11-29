function createAssetHandling (lib, Node, util) {
  'use strict';

  var Fs = Node.Fs,
    Path = Node.Path,
    StringAssetPreparator = require('./stringassetpreparatorcreator')(lib, Node),
    StraightForwardStringAssetPreparatorBase = require('./straightforwardstringassetpreparatorbasecreator')(lib, StringAssetPreparator),
    CSSStringAssetPreparator = require('./cssstringassetpreparatorcreator')(lib, StraightForwardStringAssetPreparatorBase),
    StraightForwardJSStringAssetPreparator = require('./cssstringassetpreparatorcreator')(lib, StraightForwardStringAssetPreparatorBase),
    JSStringAssetPreparator = require('./jsstringassetpreparatorcreator')(lib, Node, StringAssetPreparator, stringAssetPreparatorFactory),
    OriginalPBAssetsProcessorBase = require('./originalpbassetsprocessorbasecreator')(lib),
    OriginalPBJSAssetsProcessor= require('./originalpbjsassetsprocessorcreator')(lib, OriginalPBAssetsProcessorBase),
    OriginalPBCSSAssetsProcessor= require('./originalpbcssassetsprocessorcreator')(lib, OriginalPBAssetsProcessorBase);

  function Assets (reader) {
    this.reader = reader;
  }
  Assets.prototype.destroy = function () {
    this.reader = null;
  };

  Assets.prototype.processOriginalProtoboard = function (protoboard, pagename) {
    var depcsss = (new OriginalPBJSAssetsProcessor(this, protoboard, pagename).go());
    (new OriginalPBCSSAssetsProcessor(this, protoboard, pagename, 'pre').go());
    this._handleAssetsFound(depcsss);
    depcsss.forEach(this.reader.conditionalAddToComponent.bind(this.reader));
    (new OriginalPBCSSAssetsProcessor(this, protoboard, pagename, 'post').go());
    protoboard.css = protoboard.css.pre.concat(depcsss).concat(protoboard.css.post);
  };

  Assets.prototype._processAsset = function (root_if_no_component, record) {
    if (!record) {
      console.trace();
      console.log('cannot _processAsset, no record!');
      process.exit(0);
    }
    var ret = {
      component:null,
      src_path:null,
      dest_path:null,
      resolved: false
    },
      realret = {},
      mydistro = this.reader.distro,
      mydevel = this.reader.devel,
      mycwd = this.reader.cwd,
      alternative = null,temp = null;

    if (!lib.isString(record)) {
      //basepath field: path
      //production field: minified path
      //devel field: devel path
      //conditional field: conditional tag
      //distro field : choices for different build distro

      if (!record.basepath) {
        record.basepath = './';
      }

      if (!record.production) record.production = record.devel;
      alternative = mydevel ? record.devel : record.production;

      if (record.distro) {
        if (mydistro in record.distro) {
          var rdd = record.distro[mydistro];
          if (lib.isString(rdd)){
            alternative = rdd;
          }else{
            if (!rdd.devel) {
              return this.reader.error('No devel distro asset in record: '+JSON.stringify(rdd));
            }
            if (!rdd.production) rdd.production = rdd.devel;

            alternative = mydevel ? rdd.devel : rdd.production;
          }
        }
      }
      if (!alternative) return this.reader.error('Record invalid:'+JSON.stringify(record, null, 2));
      ret.dest_path = Path.join(root_if_no_component, record.basepath, alternative);
      ret.src_path = mydevel ? Path.join(root_if_no_component, ret.dest_path) : util.absolutizePath (mycwd, ret.dest_path);
      ret.conditional = record.conditional;
      //console.log('_prepareAsset string', ret);
      realret[root_if_no_component] = [ret];
      return this._handleAssetsFound(realret);
    }else{
      return this._prepareStringAsset(root_if_no_component, record, ret);
    }
  }
  Assets.prototype._prepareStringAsset = function (root_if_no_component, assetstring) {
    return this._handleAssetsFound((stringAssetPreparatorFactory(this.reader, assetstring, root_if_no_component)).go());
  };

  Assets.prototype._handleAssetsFound = function (assets) {
    if (lib.isArray(assets)) {
      this._assetsForEacher(assets);
    } else {
      lib.traverseShallow(assets, this._assetsForEacher.bind(this));
    }
    return assets;
  };

  Assets.prototype._assetsForEacher = function (assets, type) {
    assets.forEach(this._handleAssetFound.bind(this));
  };

  Assets.prototype._handleAssetFound = function (asset) {
    if (asset.component) {
      this.reader._requireComponent(asset.component);
    }
  };

  function stringAssetPreparatorFactory (reader, assetstring, root_if_no_component, straightforward) {
    assetstring = util.recognizeModule(assetstring, reader.pb_data);
    switch(root_if_no_component) {
      case 'js':
        return straightforward ? new StraightForwardJSStringAssetPreparator(reader, assetstring) : new JSStringAssetPreparator(reader, assetstring);
      case 'css':
        return new CSSStringAssetPreparator(reader, assetstring);
      default:
        throw new Error('Asset processing pass '+root_if_no_component+' not recognized');
    }
  }

  return Assets;
}

module.exports = createAssetHandling;
