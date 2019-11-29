function createAddPage (Lib, Node, Protoboard) {
  'use strict';

  var Fs = Node.Fs,
    Path = Node.Path,
    Q = Lib.q,
    QLib = Lib.qlib;

  function PageAdder(page, options){
    this.force = options ? !!options.force : false;
    this.frameworks = options && options.frameworks ? options.frameworks.split(',') : null;
    this.page = page;
    this.pbdata = null;
    this._cwd = Node.getProtoboardPath(process.cwd());
    this._page_path = Path.resolve(this._cwd, 'pages', this.page);
    this._js_path = Path.resolve(this._cwd, 'js', this.page);
    this._allex_dev = Path.resolve(this._cwd, 'allexdev', this.page+'.js');
  }

  PageAdder.prototype.go = function () {
    process.chdir(this._cwd);
    if (!Protoboard.webapp.isWebapp(this._cwd)){
      return Q.reject (new Error('Not a webapp'));
    }
    this.pbdata = Fs.readJSONSync('protoboard.json');
    if (!this.pbdata) return Q.reject(new Error('No pbdata'));
    if (Fs.dirExists(this._page_path)) {
      return Q.reject(new Error('Page path already exists: '+this._page_path));
    }

    var templates = Path.resolve(__dirname, '..', 'templates', 'webapp', 'page');
    ///copy JS files ...
    Node.executeCommandSync('cp -r '+Path.resolve(templates, '.allexns.json')+' '+this._cwd);
    Node.executeCommandSync('mkdir -p '+this._js_path+' && cp -r '+Path.resolve(templates, 'js', '*')+' '+this._js_path);
    Fs.writeFileSync(this._allex_dev, Fs.readFileSync (Path.resolve(templates, 'allexdev.js'),'utf-8').replace ('__PAGENAME__', this.page));

    ///copy page content
    Node.executeCommandSync ('cp -r '+Path.resolve(templates, 'page '+this._page_path));
    return this.frameworks ? Q.all(this.frameworks.map(this.loadFrameworks.bind(this))).then (this.finalize.bind(this)) : this.finalize();
  };


  PageAdder.prototype.finalize = function () {
    return Q.resolve('WebApp page created');
  };

  PageAdder.prototype.loadFrameworks = function (framework) {
    var sdk_path = Path.resolve (__dirname, '..'),
      templates = Path.resolve (sdk_path, 'templates', 'webapp', 'page_frameworks', framework);

    if (!Fs.dirExists (templates)) return Q.reject (new Lib.Error('MISSING_SCAFFOLDER', 'Missing templates '+framework));
    var ret = require(templates)(this._cwd, this.page);
    return Q.isPromise(ret) ? ret : Q.resolve(true);
  };


  function addpage (page, options){
    return (new PageAdder(page, options)).go();
  }
  return addpage;
}

module.exports = createAddPage;
