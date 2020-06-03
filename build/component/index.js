function createComponentLib (lib, Node) {
  'use strict';
  
  var Map = lib.Map,
    Fs = Node.Fs,
    Path = Node.Path,
    util = require('./utilcreator')(lib, Node);


///Component

  function recognizeExtension (ext) {
    switch (ext) {
      case '.css':
        return 'css';
      case '.js':
        return 'js';
      case '.svg':
        return 'graphics';
      case '.ttf':
        return 'fonts';
      case '.woff':
        return 'fonts';
      case '.woff2':
        return 'fonts';
      default:
        throw new Error('File extension '+ext+' not recognized as an Asset extension');
    }
  }

  function Component (record) {
    this.name = record.component;
    this.path = record.module_path;
    this.distpath = record.module_dist_path;
    this.public_dirs = record.public_dirs;
    this.protoboard = record.protoboard;
    this.assets = {};
  }
  Component.prototype.destroy = function () {
    this.assets = null;
    this.protoboard = null;
    this.public_dirs = null;
    this.distpath = null;
    this.path = null;
    this.name = null;
  };
  Component.prototype.addAsset = function (record) {
    var ext = recognizeExtension(Path.extname(record.dest_path)),
      assets = this.assets[ext];
    if (!assets) {
      assets = [];
      this.assets[ext] = assets;
    }
    assets.push({
      src: record.src_path,
      dest: record.dest_path
    });
  };
  Component.prototype.traverseProtoboardPartials = function (cb, dirpath) {
    if (!this.protoboard) {
      return;
    }
    if (this.protoboard.partials) {
      lib.traverseShallow(this.protoboard.partials, cb.bind(null, Path.relative(dirpath, this.path)));
    }
  };

//////////////////

  function Components (dir, options) {
    Map.call(this);
    this.cwd = Path.resolve(dir);
    this.components_dir = null;
    this.includes = [];
    this.initialize(options || {});
  }
  lib.inherit(Components, Map);
  Components.prototype.destroy = function () {
    this.cwd = null;
    lib.containerDestroyAll(this);
    Map.prototype.destroy.call(this);
  };

  Components.prototype.initialize = function (options) {
    var dirresult;
    dirresult = util.tryBowerForIncludes(this.includes, this.cwd);
    if (dirresult) {
      this.components_dir = dirresult;
    }
    dirresult = util.tryNpmForIncludes(this.includes, this.cwd);
    if (dirresult) {
      this.components_dir = dirresult;
    }
  };
  
  Components.prototype.search = function () {
  };

  Components.prototype.searchDir = function (dir) {
  };

  Components.prototype.allocateComponent = function (name) {
    var ret = this.get(name);
    if (ret) {
      return ret;
    }
    if (lib.isVal(ret)) {
      console.error('name', name, '=>', ret);
      throw new Error('Allocated component may be only null, undefined, or a Component instance');
    }
    this.replace(name, null);
    return null;
  };

  Components.prototype.storeComponent = function (name, path) {
    console.trace();
    process.exit(1);
    var comp = this.get(name);
    if (comp) {
      return comp;
    }
    if (!Fs.dirExists(path)) {
      return;
    }
    comp = new Component(name, path);
    this.add(name, comp);
    return comp;
  };

  Components.prototype.addToComponent = function (record) {
    var comp, oldcomp;
    if (!record) {
      return null;
    }
    if (!record.component) {
      return null;
    }
    comp = this.get(record.component);
    if (!comp) {
      comp = new Component(record);
      oldcomp = this.replace(comp.name, comp);
      if (oldcomp) {
        console.trace();
        process.exit(0);
      }
    }
    comp.addAsset(record);
    return comp;
  };

  Components.prototype.getUnresolved = function () {
    var ret = [], _r = ret;
    this.traverse(unresolveder.bind(null, _r));
    _r = null;
    return ret;
  };

  function unresolveder (result, component, name) {
    if (!lib.isVal(component)) {
      result.push(name);
    }
  }

  Components.prototype.haveUnresolvedComponents = function () {
    return this.traverseConditionally(isunresolveder);
  };

  function isunresolveder (comp) {
    if (!comp) return true;
  }

  /*
  Components.prototype.searchForComponentsInDir = function (dir) {
    var bower_fp = Path.resolve(this.cwd, dir, 'bower.json'),
      pb_fp = Path.resolve(this.cwd, dir, 'protoboard.json');
    if (Fs.fileExists(pb_fp) && Fs.fileExists(bower_fp)){
      ///this is exact component dir ...
      //console.log('this is exact component dir ...');
      var name = Fs.readFieldFromJSONFile(bower_fp, 'name');
      if (!this.get(name)){
        this.storeComponent(name, Path.resolve(this.cwd, dir));
      }
      return;
    }else{
      //console.log(Path.resolve(this.cwd, dir), 'is NOT exact component dir ...');
      if (!Fs.dirExists(dir)) return;
      Fs.readdirSync(dir).forEach(isComponentSuitable.bind(null, this, dir));
    }

    //return this.getUnresolvedComponents().length ? undefined : true;
    return this.components.haveUnresolvedComponents();
  };
  */

  return Components;
}

module.exports = createComponentLib;
