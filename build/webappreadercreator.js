var REFERENCES = require('./predefined_references.json');

function createPBWebAppReader (Lib, Node, globalutil) {
  'use strict';

  var Fs = Node.Fs,
    Allex = require('allex_allexjshelperssdklib')(Lib),
    Path = Node.Path,
    Q = Lib.q,
    QLib = Lib.qlib,
    Components = require('./component')(Lib, Node),
    Assets = require('./asset')(Lib, Node, globalutil);

  function PBWebAppReader (dir, options) {
    if (!options) options = {};
    this.cwd = Path.resolve(dir);
    var pb_path = Path.join(this.cwd, 'protoboard.json');
    if (!Fs.fileExists(pb_path)) return this.error('No file: "protoboard.json" in '+this.cwd);
    this.pb_data = Fs.safeReadJSONFileSync(pb_path);
    this._references = Lib.extend({}, REFERENCES, this.pb_data.references);
    if (!this.pb_data) this.pb_data = {};
    if (!this.pb_data.partials) this.pb_data.partials = {};
    if (!this.pb_data) return this.error('No protoboard data in file: '+pb_path);
    if (!this.pb_data.protoboard && this.pb_data.protoboard.role !== 'web_app') return this.error('Invalid protoboard content at '+this.cwd);

    this.requires_connection = this.pb_data.protoboard.requires_connection;
    this.devel = ('devel' in options) ? options.devel : true;
    this.distro = ('distro' in options) ? options.distro : null;
    this.symlinkinghints = ('symlinkinghints' in options) ? 
      (Lib.isArray(options.symlinkinghints) ? options.symlinkinghints : [])
      :
      [];
    this.verbose = options.verbose;
    this.assets = new Assets(this);
    var includes = [];

    this.components_dir = null;

    if (options.includes){
      if (Lib.isString(options.includes)) includes.push(options.includes);
      if (Lib.isArray(options.includes)) Array.prototype.push.apply(includes, options.includes);
    }
    this.includes = includes.map(transformIncludePath.bind(null, this, this.cwd));
    this.components = new Components(this.cwd);//{};
    this.pages = {};
    this.partials = [];
    this.jstemplates = {};
  }

  PBWebAppReader.prototype.destroy = function () {
    this.verbose = null;
    this.symlinkinghints = null;
    this._references = null;
    this.components_dir = null;
    Lib.objNullAll(this.jstemplates);
    this.jstemplates = null;

    Lib.objNullAll(this.partials);
    this.partials = null;

    Lib.objNullAll(this.pages);
    this.pages = null;

    /*
    Lib.objNullAll(this.components);
    this.components = null;
    */
    if (this.components) {
      this.components.destroy();
    }
    this.components = null;

    Lib.arryNullAll(this.includes);
    this.includes = null;

    this.devel = null;
    this.requires_connection = null;
    this.cwd = null;
    this.defer = null;
    this.distro = null;
    if (this.assets) {
      this.assets.destroy();
    }
    this.assets = null;
  };

  PBWebAppReader.prototype.go = function () {
    Fs.ensureDirSync('node_modules');
    this.buildNamespace();
    Lib.traverse(this.pb_data.pages, this._process_page.bind(this));
    //this.searchComponents.bind(this);
    return this;
  };

  PBWebAppReader.prototype.getSafeDistro = function () {
    return this.distro ? this.distro : (this.devel ? 'devel' : 'production');
  };

  PBWebAppReader.prototype.getDefaultConnection = function () {
    var version = this.devel ? 'devel' : 'production';
    if (this.pb_data.protoboard && this.pb_data.protoboard.default_connections && this.pb_data.protoboard.default_connections[version]){
      return this.pb_data.protoboard.default_connections[version];
    }else{
      return this.devel ? './connections/local' : './connections/public';
    }
  };

  function absolutizePath(root, path) {
    return Path.isAbsolute(path) ? path : Path.resolve(root, path);
  }

  function transformIncludePath(pbw, root, path) {
    if (!path) return pbw.error('Invalid path ...'+path);
    var ret = absolutizePath(root, path);
    if (!Lib.isString(ret)) return pbw.error('Invalid includes path '+ret);
    return ret;
  };

  PBWebAppReader.prototype.connectionDataTemplateTarget = function () {
    return Path.resolve(this.cwd, 'js', '_connection.js');
  };

  PBWebAppReader.prototype.set_connection_data = function (connection_data) {
    if (this.connection_data) return this.error('Connection data already set ...');
    ////TODO: what to do with this ?!?!?!
    //if (!this.requires_connection) return this.error('Connection data was never required');

    this._prepareJSTemplate({
      dest_path: this.connectionDataTemplateTarget(),
      src_path: Path.resolve(__dirname, '../../templates/connection.js'),
      data: {'connection':JSON.stringify(connection_data)}
    });
  };

  PBWebAppReader.prototype.isConnectionDataSet = function () {
      return this.jstemplates[this.connectionDataTemplateTarget()];
  };

  PBWebAppReader.prototype._prepareJSTemplate = function (rec) {
    this.jstemplates[rec.dest_path] = rec;
  };

  PBWebAppReader.prototype._preparelocalPartials = function () {
    this._iteratePartialsSubDir(null, 'partials');
  };

  PBWebAppReader.prototype._iteratePartialsSubDir = function (cwd, path) {
    var content = {
      files: [],
      dirs: []
    };
    if (cwd) {
      path = Path.join(cwd, path);
    }

    var root = Path.resolve(this.cwd, path);
    if (Fs.dirExists(root)) Fs.readdirSync(root).forEach(diversify.bind(null, content, root));
    if (content.files.length) {
      this.pb_data.partials[path] = content.files;
    }
    if (content.dirs.length) {
      content.dirs.forEach(this._iteratePartialsSubDir.bind(this, path));
    }
  }

  function diversify (content, root, item) {
    var stat = Fs.lstatSync(Path.resolve(root, item));
    if (stat.isSymbolicLink()){
      ///will ignore symbolic links ...
      return;
    }
    if (stat.isFile()) content.files.push(item);
    if (stat.isDirectory()) content.dirs.push(item);
  };

  PBWebAppReader.prototype._finalize_partials = function (record, root){
    var component_name = extractComponentName(root);
    if (component_name) this._requireComponent(component_name);
    if (Lib.isArray(record)) {
      Array.prototype.push.apply(this.partials,record.map(this._preparePartialsRecord.bind(this, root, component_name)));
    }
  };

  PBWebAppReader.prototype._preparePartialsRecord = function (root, component_name, rec) {
    var src = Path.join(root, rec);
    var ret = {
      component: component_name,
      resolved: false,
      src_path: component_name ? replaceComponentsDirPath(component_name, src) : Path.resolve(this.cwd, src),
      dest_path:component_name ? replaceComponentsDirPath(component_name, src, ['partials'], -1) : Path.resolve(this.cwd, '_generated', src)
    };
    return ret;
  };

  function findreferencestring (item, index) {
    if (Lib.isString(item) && item.charAt(0) === '#') return index;
  }

  function replacePage (name, item) {
    if (!Lib.isString(item)) return item;
    return item.replace('PAGE', name);
  }

  PBWebAppReader.prototype.resolveReferences = function (list, page) {
    try {
      var references_list = [];
      while (true) {
        var index = Lib.traverseConditionally(list, findreferencestring);
        if (Lib.isUndef(index)) {
          break;
        }
        var ref = list[index];
        if (references_list.indexOf(ref) > -1) {
          throw new Error("Circular dependency detected: "+ref);
        }
        if (!this._references[ref]) throw new Error('Missing reference '+ref);
        var args = [index, 1].concat(this._references[ref]);
        Array.prototype.splice.apply(list, args);
      }
      if (!list) return [];

      return list.map(replacePage.bind(null, page));
    }catch (e) {
      console.log(e, e.stack);
    }
  };

  PBWebAppReader.prototype._process_page = function (p_data, name){
    if (this.pages[name]) throw new Error('Duplicate page declaration '+name);
    this.assets.processOriginalProtoboard(p_data, name);
    /*
    this._processAssets('js', p_data, name);
    this._processAssets('css', p_data, name);
    */
    return this.onJSCSS(p_data, name);
  };

  PBWebAppReader.prototype._processAssets = function (field, p_data, name) {
    p_data[field] = clearDuplicates(this.resolveReferences(p_data[field], name).reduce(this._processAsset.bind(this, field), []));
  };

  PBWebAppReader.prototype.onJSCSS = function (p_data, name) {
    //var js = jscss[0], css = jscss[1];
    var js = p_data.js, css = p_data.css;
    //console.log('js', js);
    if (!Lib.isArray(js)) {
      console.error('no js', jscss);
      process.exit(1);
    }
    if (!Lib.isArray(css)) {
      console.error('no css', jscss);
      process.exit(1);
    }
    this.pages[name] = {
      'connection' : false,
      'js': js,
      'css': css,
      'vars': p_data.vars,
      'distro_vars' : p_data.distro_vars,
      'include_manifest_devel' : p_data.include_manifest_devel,
    };


    if ( this.requires_connection ) {
      this.pages[name].connection = 'connection' in p_data && !p_data.connection ? false : true;
    }

    if (this.pages[name].connection) {
      return this._processSourceLessAsset('js','_connection.js').then(
        this.onSourceLessAsset.bind(this)
      );
    }
  };

  PBWebAppReader.prototype.onSourceLessAsset = function (asset) {
    this.pages[name].js.unshift(asset);
    return Q(true);
  };

  var AVAILABLE_PREFIXES = [/^components\//,/^node_modules\//];

  function replaceComponentsDirPath (name, src, replacement, startfrom) {
    var compdirarry = src.split(Path.sep),
      nameind = compdirarry.indexOf(name),
      retarry = Lib.isArray(replacement) ? replacement : [];
    startfrom = startfrom || 0;
    if (nameind<0) {
      return src;
    }
    Array.prototype.push.apply(retarry, compdirarry.slice(nameind+1+startfrom));
    return retarry.join(Path.sep);
  };

  function matchAvailablePrefixes(path){
    var ret = {match : false};
    if (!Lib.isString(path)) return ret;
    for (var i=0; i<AVAILABLE_PREFIXES.length; i++){
      if (path.match(AVAILABLE_PREFIXES[i])){
        ret.match = true;
        break;
      }
    }
    return ret;
  }

  function extractComponentName (path) {
    var ret = null, temp = null;
    if (matchAvailablePrefixes(path).match === true) {
      temp = path.split('/');
      ret = temp[1];
      if (!ret) return this.error('Components record must have component name '+path);
    }
    return ret;
  }

  PBWebAppReader.prototype._processSourceLessAsset = function (root_if_no_component, record) {
    throw new Error('_processSourceLessAsset is currently not supported');
    return this._processAsset(root_if_no_component, record);
  };

  PBWebAppReader.prototype.conditionalAddToComponent = function (record) {
    if (record.component) {
      this.components.addToComponent(record);
    }
  };
  PBWebAppReader.prototype._processAsset = function (root_if_no_component, result, record) {
    var ret = this.assets.processAsset(root_if_no_component, record);
    //console.log('record', record, '=>', ret);
    ret.forEach(this.conditionalAddToComponent.bind(this));
    Array.prototype.push.apply(result, ret);
    return result;
  };

  PBWebAppReader.prototype.onSrcPathForPrepareAsset = function (root_if_no_component, ret, src_path) {
    ret.src_path = src_path;
    ret.dest_path = ret.src_path.replace('node_modules','components');
    ret.component = extractComponentName(ret.src_path);

    if (ret.component) {
      this._requireComponent(ret.component);
    }else{
      var is_public = Lib.traverseConditionally (this.pb_data.public_dirs,isPublicAsset.bind(null, ret.src_path));

      if (ret.src_path.match (/(\:\/\/)/)) throw new Error('Global links now allowed: '+ret.src_path);

      ret.src_path = Path.resolve(this.cwd, is_public ? './' : root_if_no_component, ret.src_path);
      ret.dest_path= Path.join(is_public ? './' : root_if_no_component, ret.dest_path);
      ret.resolved = true;
    }
    return Q(ret);
  };

  function isPublicAsset (ret, public_dir) {
    if (ret.match (new RegExp('^'+public_dir+'\/'))) {
      return true;
    }
  }

  PBWebAppReader.prototype.testForAllex = function (assetstring) {
    var spl1 = assetstring.split('/');
    return Lib.moduleRecognition(spl1.shift()).then(onRecognizedForTestForAllex.bind(null, spl1));       
  };

  function onRecognizedForTestForAllex (spl1, component) {
    if (!component) return Q(null);
    if (Lib.isString(component)) return Q(null);
    return Q('components/'+component.modulename+'/'+(spl1.length ? spl1.join('/') : 'dist/browserified.js'));
  }

  PBWebAppReader.prototype.onTestedForAllex = function (root_if_no_component, record, ret, testresult) {
    return this.onSrcPathForPrepareAsset(root_if_no_component, ret, testresult ? testresult : record);
  };

  PBWebAppReader.prototype._requireComponent = function (name) {
    return this.components.allocateComponent(name);
  };

  PBWebAppReader.prototype.buildNamespace = function () {
    var nsfile;
    try {
      nsfile = Fs.readJSONSync(Path.join(Node.getNamespacePath(), '.allexns.json'));
      Fs.ensureDirSync(Path.join('node_modules', 'allexns'));
      Fs.writeFileSync(Path.join('node_modules', 'allexns', 'ns.js'), "window['.allexns.js'] = "+JSON.stringify(nsfile, null, 2)+";\n");
      Fs.writeFileSync(Path.join('node_modules', 'allexns', 'package.json'), JSON.stringify({
        name: 'allexns',
        private: true
      }, null, 2));
    } catch (e) {
      return Q.reject(new Error('Cannot read .allexns.json: '+e.message));
    }
    return Q(true);
  };

  PBWebAppReader.prototype.searchComponents = function () {
    var bower_path = Path.resolve(this.cwd, 'bower.json'),
      deps = null;
    if (Fs.fileExists(bower_path)){
      deps = Fs.readFieldFromJSONFile(bower_path, 'dependencies');
    }

    if (deps) {
      for (var i in deps) {
        this._requireComponent(i);
      }
    }

    Lib.traverseConditionally (this.includes, this._searchComponents.bind(this));
    return Q.all(this.getUnresolvedComponents().map (this.resolveAllexComponent.bind(this)));
  };

  PBWebAppReader.prototype.resolveAllexComponent = function (name) {
    return Allex.paths.allexServiceWebC(name, this.cwd).then (this._checkAllexComponentExists.bind(this, name));
  };

  PBWebAppReader.prototype._checkAllexComponentExists = function (name, p) {
    if (Fs.dirExists(p)) {
      this.storeComponent(name, p);
    }else{
      this.storeComponent(name, Path.join(this.cwd,'node_modules',name));
    }
    return Q.resolve (true);
  };

  PBWebAppReader.prototype._searchComponents = function (dir){
    var bower_fp = Path.resolve(this.cwd, dir, 'bower.json'),
      pb_fp = Path.resolve(this.cwd, dir, 'protoboard.json');
    if (Fs.fileExists(pb_fp) && Fs.fileExists(bower_fp)){
      ///this is exact component dir ...
      //console.log('this is exact component dir ...');
      var name = Fs.readFieldFromJSONFile(bower_fp, 'name');
      if (!this.components.get(name)){
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

  PBWebAppReader.prototype.storeComponent = function (name, path) {
    var comp = this.components.storeComponent(name, path);
    if (comp) {
      comp.traverseProtoboardPartials(expandPBPartialsRecordWithComponentPartials.bind(null, this.pb_data.partials), this.cwd);
    }
  };

  function expandPBPartialsRecordWithComponentPartials (pbdata, component_path, partials, root) {
    console.log('expandPBPartialsRecordWithComponentPartials', component_path, partials, root);
    var nr = Path.join(component_path, root);
    if (pbdata[nr]) return; //won't affect webapp partials data ....
    pbdata[nr] = partials;
    console.log(nr, '=>', pbdata[nr]);
  }

  function isComponentSuitable (pbw, root, dir){
    var fp = absolutizePath(root, dir);
    if (!Fs.dirExists(fp)) return;
    var name = Path.basename(fp), 
      bower = Path.resolve(fp, 'bower.json'),
      pkgjsn = Path.resolve(fp, 'package.json');
    if (Fs.fileExists(bower)) {
      name = Fs.readFieldFromJSONFile(bower, 'name');
    } else if (Fs.fileExists(pkgjsn)) {
      name = Fs.readFieldFromJSONFile(pkgjsn, 'name');
    }

    if (pbw.components.get(name)) return;
    pbw.storeComponent(name, fp);

  }

  PBWebAppReader.prototype.getUnresolvedComponents = function () {
    return this.components.getUnresolved();
  };

  PBWebAppReader.prototype.error = function (str){
    throw new Error(str);
  };

  PBWebAppReader.prototype.resolveAssets = function () {
    var l  = this.getUnresolvedComponents().length;
    if (l) return this.error('Unable to resolve assets until all components are ready ...');
    Lib.traverse(this.pages, this._resolvePage.bind(this));
    this.partials.forEach(this._resolveAsset.bind(this));
  };

  PBWebAppReader.prototype._resolvePage = function (page_data, name){
    page_data.js.forEach(this._resolveAsset.bind(this));
    page_data.css.forEach(this._resolveAsset.bind(this));
  };

  PBWebAppReader.prototype._resolveAsset = function (rec) {
    //console.log(JSON.stringify(rec));
    if (rec.resolved || !rec.component) {
      return; ///nothing to be done: either resolved eithec component igonrant ...
    }
    //console.log('--- DAVAJ',this.components,rec);
    //var component = this.components[rec.component];
    var component = this.components.get(rec.component);
    if (!component) return; /// component not resolved yet ...

    rec.resolved = true;
    rec.src_path = Path.resolve(this.cwd, component.distpath, rec.src_path);
  };

  PBWebAppReader.prototype.finalize = function () {
    if (!this.isReady()) throw new Error('Unable to finalize since I am not as ready as you might think...');

    this._preparelocalPartials();
    Lib.traverseShallow(this.pb_data.partials, this._finalize_partials.bind(this));
    this.resolveAssets();
  };

  PBWebAppReader.prototype.isReady = function () {
    var len = this.getUnresolvedComponents().length;
    var ret = (this.requires_connection ? len === 0 && this.isConnectionDataSet() : len === 0);
    if (ret) return !!ret;
    Node.error('Unresolved components '+len+' ('+this.getUnresolvedComponents().join(',')+')',', connection set: ',!!this.isConnectionDataSet());
  };

  PBWebAppReader.prototype.getProtoboards = function () {
    var ret = [];
    Lib.traverse(this.components, isProtoboard.bind(null, ret));
    return ret;
  };

  PBWebAppReader.prototype.doneWithModules = function () {
    var len = this.getUnresolvedComponents().length;
    if (!len) {
      //nothing to be done _fireIfReady will do needed ...
      return;
    }
  };

  PBWebAppReader.prototype.trySymLinkModule = function (modulename) {
    if (!this.devel) {
      return false;
    }
    if (!Lib.isArray(this.symlinkinghints)) {
      return false;
    }
    return this.symlinkinghints.some(this.trySymLinkModuleOnHint.bind(this, modulename));
  };

  PBWebAppReader.prototype.trySymLinkModuleOnHint = function (modulename, hint) {
    var target = Path.isAbsolute(hint) ?
      Path.join(hint, modulename)
      :
      Path.join(this.cwd, hint, modulename);
    if (Fs.dirExists(target)) {
      Node.info('Symlinking '+target+' as '+modulename);
      Fs.symlinkSync(target, modulename, 'dir');
      return true;
    }
  };

  function isProtoboard (ret, rec) {
    if (rec.protoboard) ret.push (rec);
  };

  return PBWebAppReader;
}

module.exports = createPBWebAppReader;

