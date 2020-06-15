'use strict';
function logj (data) {
  console.log(JSON.stringify(data, null, 2));
}

function createPBWebAppInterpreter (Lib, Node) {
  'use strict';

  var Node = require('allex_nodehelpersserverruntimelib')(Lib),
    Fs = Node.Fs,
    Path = Node.Path,
    WEBAPP_TEMPLATES = Path.resolve (__dirname, '..', '..', 'templates', 'webapps');

  ///Grunt based interpreter ...
  function PBWebAppInterpreter (pbwr, grunt, params) {
    this.required_files = null;
    this.required_dirs = null;
    this.pbwr = pbwr;
    this.cwd = this.pbwr.cwd;
    this.reset();
    this.go = this._go.bind(this, grunt, params);
    this.done = new Lib.HookCollection();
    grunt.task.options({
      done: this.done.fire.bind(this.done)
    });
  }

  PBWebAppInterpreter.prototype.destroy = function () {
    this.pbwr = null;
    this.cwd = null;
    Lib.objNullAll(this.required_files);
    this.required_files = null;
    Lib.objNullAll(this.required_dirs);
    this.required_dirs = null;
    this.go = null;
    this.done.destroy();
    this.done = null;
  };

  PBWebAppInterpreter.prototype.reset = function () {
    this.required_files = {};
    this.required_dirs = {};
  };


  function map_to_cp_command (item) {
    var dest = Path.join('_generated', item.dest),
      ret = 'mkdir -p '+Path.dirname(dest)+' && cp -LRp '+item.src+' '+dest;
    //console.log('will', ret);
    return ret;
  }


  PBWebAppInterpreter.prototype._go = function (grunt, params) {
    var linkpath, testdir;
    Fs.removeSync(Path.resolve(this.cwd, '_generated'));
    if (!this.pbwr) return this.error('No reader set ...');
    if (!this.pbwr.isReady()) {
      var unresolved = this.pbwr.getUnresolvedComponents();
      if (unresolved.length) return this.error('Reader not ready, missing components: '+unresolved.join(','));
      if (!this.pbwr.connection_data) return this.error('No connection data provided');
      return this.error('This should never happen  ...');
    }

    var page_grunt = this.gruntPages();
    var config = {
      html_template: page_grunt.template,
      symlink: {
        pages : {files: page_grunt.html}
      },
      jshint:{},
      exec: {
        clean: 'rm -rf '+Path.resolve(this.cwd, '_tmp')
      },
      serviceworker: page_grunt.serviceworker
    };

    //first check if there is a link to includes and layouts
    linkpath = Path.resolve(this.cwd, 'includes');
    if (!Fs.existsSync(linkpath)){
      try {
      if (Fs.readlinkSync(linkpath)){
        Fs.removeSync(linkpath);
      }}catch(ignore){}
      config.symlink.includes = {
        files : [{src: Path.resolve(WEBAPP_TEMPLATES, 'includes'), dest: Path.resolve(this.cwd, 'includes')}]
      };
    }else{
      config.symlink.includes = {};
    }

    linkpath = Path.resolve(this.cwd, 'layouts');
    if (!Fs.existsSync(linkpath)){
      try {
      if (Fs.readlinkSync(linkpath)){
        Fs.removeSync(linkpath);
      }} catch(ignore){}
      config.symlink.layouts = {
        files : [{src: Path.resolve(WEBAPP_TEMPLATES, 'layouts'), dest: Path.resolve(this.cwd, 'layouts')}]
      };
    }else{
      config.symlink.layouts = {};
    }


    if (this.pbwr.devel) {
      config.jshint.devel = {
        options: {
          globals: {
            'jQuery': true,
            'angular':true
          }
        },
        files: {
          src: Path.resolve(this.cwd, 'js')+'/**'
        }
      };
      config.symlink.components = {files: this.symlinkComponents()};

      config.symlink.js = {files:[{src:Path.resolve(this.cwd, 'js'), dest:Path.resolve(this.cwd,'_generated', 'js')}]};
      config.symlink.css= {files:[{src:Path.resolve(this.cwd, 'css'),dest:Path.resolve(this.cwd,'_generated','css')}]};
      config.symlink.publics = {files:this.publicDirs()};
      config.symlink.partials = {files:this.symlinkPartials()};
      config.symlink.partials.files.forEach(this.require_existence.bind(this, 'dest', 'src'));
      config.symlink.roots = { files: this.symlinkRoots()};
    }else{
      var docopya = ['echo "starting file copy ..."'];
      testdir = Path.resolve(this.cwd, 'css');
      if (!Fs.dirIsEmpty(testdir)) {
        docopya.push(map_to_cp_command({src: testdir+(Path.sep+'*'), dest: 'css'}));
      }
      Array.prototype.push.apply(docopya, this.copyComponents().map(map_to_cp_command.bind(this)));
      Array.prototype.push.apply(docopya, this.publicDirs().map(map_to_cp_command.bind(this)));
      Array.prototype.push.apply(docopya, this.symlinkPartials().map(map_to_cp_command.bind(this)));
      Array.prototype.push.apply(docopya, this.symlinkRoots().map(map_to_cp_command.bind(this)));
      Array.prototype.push.apply(docopya, config.symlink.pages.files.map(map_to_cp_command.bind(this)));
      config.exec.docopy = docopya.join(' && ');

      config.concat = this.concatJS();
      config.uglify = {
        options: {
        },
        all: {
          files:this.uglifyJS()
        }
      };

      this.required_dirs[Path.resolve(this.cwd, '_generated','css')] = true;
      //this.required_dirs[Path.resolve(this.cwd, '_generated','partials')] = true;
      this.required_dirs[Path.resolve(this.cwd, '_generated','js')] = true;
      this.required_dirs[Path.resolve(this.cwd, '_generated','components')] = true;
    }

    config.mkdir = {
      all: {
        options:{
          create: Object.keys(this.required_dirs)
        }
      },
      tmp: {
        options:{
          create: [Path.resolve(this.cwd, '_tmp')]
        }
      }
    };
    config.fileExists = {all:Object.keys(this.required_files)};
    config.template = {};

    this.prepareManifest(config.template);
    this.prepareServiceWorker(config.template);
    if(this.pbwr.requires_connection) {
      Lib.traverse(this.pbwr.jstemplates, this._adaptJSTemplatesRecords.bind(this, config.template));
    }

    if (!Object.keys(config.template).length) {
      config.template = null;
    }


    var tasklist;
    if (this.pbwr.devel) {
      tasklist = ['fileExists', 'jshint', 'mkdir', 'symlink'];
      if (Object.keys(config.html_template).length) {
        tasklist.push ('html_template');
      }
      if (config.template) {
        tasklist.push('template');
      }
    }else{
      tasklist = [];
      if (config.template) {
        tasklist.push('template');
      }
      tasklist.push('fileExists', 'jshint', 'mkdir', 'symlink:includes', 'symlink:layouts', 'concat', 'uglify', 'exec:docopy');
      if (Object.keys(config.html_template).length) {
        tasklist.push ('html_template');
      }
    }

    tasklist.push ('exec:clean');
    if (this.pbwr.verbose) {
      Node.info('The complete Grunt configuration object:');
      console.log(require('util').inspect(config, {depth:8, colors:true}));
    }
    grunt.initConfig(config);
    grunt.registerTask('default', tasklist);
    return Lib.q(true);
  };

  PBWebAppInterpreter.prototype._adaptJSTemplatesRecords = function (config, record) {
    var files_rec = {};
    files_rec[record.dest_path] = record.src_path;
    config[record.dest_path] = {
      options: {
        data: record.data
      },
      files : files_rec
    };
  };

  function copyitempusher (ret, cwd, item, src) {
    var dest = src,
      finalsrc = Path.join(item.path, src),
      finaldest = Path.join(item.distpath, dest);
    if (Fs.dirExists(finalsrc)) {
      ret.push ({
        src: finalsrc,
        dest: finaldest
      });
    } else {
      throw new Error('Cannot copy from '+finalsrc);
    }
  }

  PBWebAppInterpreter.prototype.symlinkComponents = function () {
    var pbwr = this.pbwr, ret = [];
    pbwr.components.traverse(this._decideComponentsLink.bind(this,ret)); 
    return ret;
  };
  PBWebAppInterpreter.prototype._decideComponentsLink = function (ret,item) {
    if (!this.pbwr.devel) {
      throw new Error('Components are not to be linked in production builds');
      process.exit(1);
    }
    if (!item.public_dirs){
      ret.push({
        src: Path.join(this.cwd, item.path),
        dest: Path.join(this.cwd, '_generated', item.distpath)
      });
      if (item.protoboard && item.protoboard.copy) {
        if (!Lib.isArray(item.protoboard.copy)) {
          console.error('Problematic protoboard.copy in item', item);
          throw new Error('Copy has to be an array of destinations to copy over to _generated result');
        }
        item.protoboard.copy.forEach(linker_for_copy.bind(null, ret, this.cwd, item));
      }
    }else{
      console.log(item);
      throw new Error('public_dirs on Components are not fully resolved yet');
    }
  };

  function linker_for_copy (ret, cwd, item, src) {
    var dest = src;
    ret.push({
      src: Path.join(cwd, item.path, src),
      dest: Path.join(cwd, '_generated', item.distpath, dest)
    });
  }

  PBWebAppInterpreter.prototype.copyComponents = function () {
    var pbwr = this.pbwr, ret = [];
    pbwr.components.traverse(this._decideCopyLink.bind(this,ret)); 
    return ret;
  };
  PBWebAppInterpreter.prototype._decideCopyLink = function (ret,item) {
    if (this.pbwr.devel) {
      return;
    }
    if (item.protoboard && item.protoboard.copy) {
      if (!Lib.isArray(item.protoboard.copy)) {
        console.error('Problematic protoboard.copy in item', item);
        throw new Error('Copy has to be an array of destinations to copy over to _generated result');
      }
      item.protoboard.copy.forEach(copyitempusher.bind(null, ret, this.cwd, item));
    }
    if (item.assets) {
      Lib.traverseShallow(item.assets, pushAssetsTo.bind(null, ret));
    }
    if (item.public_dirs){
      this.required_dirs[Path.resolve(this.cwd, '_generated', 'components', item.name)] = true;
      Array.prototype.push.apply(ret,item.public_dirs.map(this._componentsPublicDirs.bind(this, item)));
    }
    ret = null;
  };

  function pushAssetsTo (target, assets, assetsname) {
    if ('js'===assetsname) {
      return;
    }
    Array.prototype.push.apply(target, assets);
  }

  PBWebAppInterpreter.prototype._componentsPublicDirs = function (item, dir) {
    ///TODO: not tested yet ...
    var src = Path.resolve(item.path, dir),
      target = Path.resolve(this.cwd, '_generated', 'components', item.name, dir)


    if (!target.length) {
      console.log('Failed', JSON.stringify(item));
    }
    this.required_dirs[Path.dirname(target)] = true;
    return {
      src: src,
      dest:target
    };
  };

  PBWebAppInterpreter.prototype.require_existence = function (dir_field, src_field, rec) {
    this.required_dirs[Path.dirname(rec[dir_field])] = true;
    if (rec[src_field]) this.required_files[rec[src_field]] = true;
  };


  PBWebAppInterpreter.prototype.getAssetList = function (type){
    if ('js' === type || 'css' === type){
      var ret = [];
      for (var i in this.pbwr.pages) {
        Array.prototype.push.apply(ret, this.pbwr.pages[i][type]);
      }
      return ret;
    }

    if ('partials' === type){
      return this.pbwr.partials;
    }
  };

  function toSymlinkRecord(self, rec) {
    return {
      src: Path.join(rec.src_path),
      dest: Path.resolve(self.cwd, '_generated', rec.dest_path)
    }
  };

  function toPartialsSymlinkRecord (self, rec) {
    var ret = toSymlinkRecord(self, rec);
    self.required_dirs[Path.dirname(ret.dest)] = true;
    return ret;
  }
  PBWebAppInterpreter.prototype.symlinkPartials = function () {
    var ret = this.getAssetList('partials').map(toPartialsSymlinkRecord.bind(null, this));
    return ret;
  };

  PBWebAppInterpreter.prototype.symlinkRoots = function () {
    var ret = [];

    var robots = this.pbwr.pb_data.robots;
    if (robots) {
      ret.push ({
        src : Lib.isString(robots) ? Path.resolve(this.cwd, robots) : Path.resolve(__dirname, '..', '..', 'templates', 'webapps', 'robots.txt'),
        dest: Path.resolve (this.cwd, '_generated', 'robots.txt')
      });
    }

    return ret;
  };

  function appendPublicDir (devel, ret, cwd, dir){
    if (Fs.dirExists(Path.resolve(cwd, dir))) {
      ret.push ({
        src: dir,
        dest: devel ? Path.join('_generated', dir) : dir
      });
    }
  }


  PBWebAppInterpreter.prototype.publicDirs = function () {
    var ret = [];
    appendPublicDir(this.pbwr.devel, ret, this.cwd, 'public');
    var rd = this.pbwr.pb_data.public_dirs;

    if (rd) {
      rd.forEach(appendPublicDir.bind(null, this.pbwr.devel, ret, this.cwd));
    }
    return ret;
  };

  PBWebAppInterpreter.prototype._assetListToCache = function (val) {
    var ret = val.dest_path.replace(Path.resolve(this.cwd,'_generated'), '');
    return ret.replace (/^\//, '');
  };

  function appendpublic (item) {
    return 'public/'+item;
  }

  function ignore (ignore_list, item) {
    ///TODO: stigli smo do ovde, ai nismo isli dalje ....
  }

  function copyfile2cache (cache, item, copysrc, srcpath, filename) {
    var filepath = Path.join(srcpath, filename), destpath;
    if (!Fs.fileExists(filepath)) {
      return;
    }
    destpath = Path.join(item.module_dist_path, copysrc, filename);
    if (cache.indexOf(destpath)<0) {
      cache.push(destpath);
    }
  }

  function copyitem2cache (cwd, item, cache, copysrc) {
    var srcpath = Path.join(cwd, item.module_path, copysrc);
    try {
      Fs.readdirSync(srcpath).forEach(copyfile2cache.bind(null, cache, item, copysrc, srcpath));
    } catch (e) {
      console.error('Error?', e);
    }
    cache = null;
    item = null;
    srcpath = null;
  }
  function copy2cache (cwd, cache, pageitem) {
    if (!(pageitem && pageitem.protoboard && Lib.isArray(pageitem.protoboard.copy))) {
      cwd = null;
      return;
    }
    pageitem.protoboard.copy.forEach(copyitem2cache.bind(null, cwd, pageitem, cache));
    cwd = null;
  }

  function sectioncopy2cache (cwd, cache, pagedatasection) {
    if (Lib.isArray(pagedatasection)) {
      pagedatasection.forEach(copy2cache.bind(null, cwd, cache));
    }
    cwd = null;
  }

  PBWebAppInterpreter.prototype.fillCache = function (cache, pagedata, name, varspropname) {
    var value = pagedata.vars[varspropname];
    if (!value) return;

    if (value.auto) {
      if (this.pbwr.devel) {
        cache.push.apply (cache, pagedata.js.map(_dest_path));
      }else{
        cache.push ('js/'+name+'.min.js');
      }
      cache.push.apply (cache, pagedata.css.map(_dest_path));
      Lib.traverseShallow(pagedata, sectioncopy2cache.bind(null, this.cwd, cache));

      if (value.auto.ignore_partials) {
        Array.prototype.push.apply(cache, this.getAssetList('partials').map(this._assetListToCache.bind(this)).filter(ignore.bind(null, value.auto.ignore_partials)));
      }else{
        Array.prototype.push.apply(cache, this.getAssetList('partials').map(this._assetListToCache.bind(this)));
      }
      if (value.auto.ignore_public) {
        Array.prototype.push.apply(cache, Fs.readdirRecursively(Path.resolve(this.cwd, 'public')).map(appendpublic).filter(ignore.bind(null, value.auto.ignore_public)));
      }else{
        Array.prototype.push.apply(cache, Fs.readdirRecursively(Path.resolve(this.cwd, 'public')).map(appendpublic));
      }
    }

    if (value.manual_cache) { //not that you can add only files to manifest ...
      Array.prototype.push.apply(cache, value.manual_cache);
    }

  };

  PBWebAppInterpreter.prototype.generateUniManifest = function (config, pagedata, name) {
    ///
    try {
      ///TODO: do some sanity checks ...
      var manifest = {
        cache: [],
        network: [],
        fallback : {} 
      };
      //this.fillCache(manifest.cache, pagedata, name, 'manifest'); //old feature, skip this
      if (!manifest.cache.length) {
        manifest.cache = null;
      }else{
      }
      if (!manifest.network.length) manifest.network = null;
      if (!Object.keys(manifest.fallback)) manifest.fallback = null;

      //console.log('generateUniManifest', config, name);
      this._adaptJSTemplatesRecords(config, {
        dest_path:Path.resolve(this.cwd, '_generated', name+'.manifest'),
        src_path:  Path.resolve(__dirname, '..', 'templates', 'webapps', 'cache_manifest.swig'),
        data: manifest
      });
    }catch (e) {
      console.log(e);
    }
  };

  function toIconsList (a, img) {
    a.push ({
      src: img.href,
      sizes: img.size+'x'+img.size,
      type: 'image/png'
    });
  }

  PBWebAppInterpreter.prototype.generateJSONManifest = function (config, pagedata, name) {
    var distro_value = pagedata.distro_vars && pagedata.distro_vars[this.pbwr.distro] ? pagedata.distro_vars[this.pbwr.distro].jsonmanifest : null,
      value = Lib.extend({}, pagedata.vars.jsonmanifest, distro_value),
      vars = this.processDistroVars(pagedata.vars, pagedata.distro_vars),
      wname = vars.webapp ? vars.webapp.title : null,
      start_url = name+'.html',
      icons = vars.icons;


    if (value.start_url) {
      if (this.pbwr.devel) {
        start_url = value.start_url.devel;
      }else{
        start_url = value.start_url.production;
      }
    }

    var icons_list = [];
    Lib.traverseShallow(icons, toIconsList.bind(null, icons_list));


    try {
      var data = {
        name: wname,
        icons : icons_list,
        start_url: start_url,
        display : value.display || 'fullscreen',
        orientation : value.orientation || undefined,
        short_name : value.short_name,
        '_webapp_timestamp' : (new Date()).getTime()
      };
      this._adaptJSTemplatesRecords (config, {
        dest_path: Path.resolve(this.cwd, '_generated', name+'.json'),
        src_path: Path.resolve(__dirname, '..', 'templates', 'webapps', 'json_manifest.swig'),
        data: {data:data}
      });
    }catch (e) {
      console.log(e);
    }
  };

  PBWebAppInterpreter.prototype._appendCacheManifest = function (config, pagedata, name) {
    if (pagedata.vars && pagedata.vars.manifest) {
      this.generateUniManifest(config, pagedata, name);
    }

    if (pagedata.vars && pagedata.vars.jsonmanifest) {
      this.generateJSONManifest(config, pagedata, name);
    }
  };

  PBWebAppInterpreter.prototype.prepareManifest = function (config) {
    Lib.traverseShallow (this.pbwr.pages, this._appendCacheManifest.bind(this, config));
  };

  function quoter (thingy) {
    return '"'+thingy+'"';
  }
  PBWebAppInterpreter.prototype.generateServiceWorker = function (config, pagedata, name) {
    var sw = {
      cache: []
    };
    //console.log('generateServiceWorker?', config);
    this.fillCache(sw.cache, pagedata, name, 'serviceworker');
    sw.cache = sw.cache.map(quoter);
    this._adaptJSTemplatesRecords(config, {
      dest_path:Path.resolve(this.cwd, '_generated', name+'.serviceworker.js'),
      src_path:  Path.resolve(__dirname, '..', 'templates', 'webapps', 'serviceworker.swig'),
      data: sw
    });
  };

  PBWebAppInterpreter.prototype._appendServiceWorker = function (config, pagedata, name) {
    this.generateServiceWorker(config, pagedata, name);
  };

  PBWebAppInterpreter.prototype.prepareServiceWorker = function (config) {
    Lib.traverseShallow (this.pbwr.pages, this._appendServiceWorker.bind(this, config));
  };

  PBWebAppInterpreter.prototype.gruntPages = function () {
    var ret = {
      template: {},
      serviceworker: {},
      html: []
    };
    for (var i in this.pbwr.pages) {
      var html_page = Path.resolve(this.cwd, 'pages', i+'.html');
      if (Fs.fileExists(html_page)) {
        ret.html.push({
          src : html_page,
          dest: Path.resolve(this.cwd, '_generated', i+'.html'),
          cwd : this.cwd
        });
      }else{
        ret.template[i] = this._gruntPage(i, this.pbwr.pages[i]);
      }
      if (this.pbwr.pages[i].serviceworker) {
        ret.serviceworker[i] = this.pbwr.pages[i].serviceworker;
      }
    }
    return ret;
  };

  PBWebAppInterpreter.prototype.error = function (s) {
    throw new Error(s);
  };

  PBWebAppInterpreter.prototype.uglifyJS = function () {
    var ret = {};
    for (var i in this.pbwr.pages) {
      ret[Path.resolve(this.cwd, '_generated', 'js', i+'.min.js')] = [Path.resolve(this.cwd, '_tmp', i+'.js')];
    }
    return ret;
  };

  PBWebAppInterpreter.prototype.concatJS = function () {
    var ret = {};
    for (var i in this.pbwr.pages) {
      ret[i+'_js_concat'] = {
        src: this.pbwr.pages[i].js.map(_src_path),
        dest: Path.join('_tmp',i+'.js'),
        nonull : true
      };
    }
    return ret;
  };

  PBWebAppInterpreter.prototype._gruntPage = function (name, data) {
    return {
      options: {
        locals: {
          js: this.pbwr.devel ? data.js.map(_to_conditionals) : [{path:Path.join('js', name+'.min.js')}],
          css:data.css.map(_to_conditionals),
          vars: this.processDistroVars(data.vars, data.distro_vars),
          devel : this.pbwr.devel,
          page: name,
          cache_manifest : this.decideToLoadManifest (name, data) ? name+'.manifest' : false,
          head_content : this.loadHeadContent(name, data)
        }
      },
      expand: true,
      cwd: Path.resolve(this.cwd, 'pages'),
      dest:Path.resolve(this.cwd, '_generated'),
      src: name+'.swig'
    };
  };

  PBWebAppInterpreter.prototype.loadHeadContent = function (name, pagedata) {
    var vars = this.processDistroVars (pagedata.vars, pagedata.distro_vars);
    if (!vars || !vars.head_content) return null;
    var content = '', p;
    for (var i = 0; i < vars.head_content.length; i++) {
      p = Path.resolve(this.cwd, vars.head_content[i]);
      if (Fs.fileExists(p)) {
        if (content.length) content += "\n";
        content += Fs.readFileSync (p, {encoding : 'utf8'});
      }
    }
    return content;
  };

  PBWebAppInterpreter.prototype.processDistroVars = function (vars, distro_vars) {
    if (!distro_vars) return vars; //nothing to be done ...
    var distro = this.pbwr.getSafeDistro();
    if (!distro_vars[distro]) return vars;
    return Lib.extend ({}, vars, distro_vars[distro]);
  };

  PBWebAppInterpreter.prototype.decideToLoadManifest = function (name, data) {
    if (this.pbwr.devel) {
      return !!data.include_manifest_devel;
    }

    return data.vars && data.vars.manifest;
  };

  function _to_conditionals (rec) {
    return {
      path : rec.dest_path,
      conditional: rec.conditional
    }
  }
  function _dest_path (rec) { return rec.dest_path; }
  function _src_path (rec) { return rec.src_path; }

  return PBWebAppInterpreter;
}

module.exports = createPBWebAppInterpreter;

