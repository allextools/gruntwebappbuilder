function createAppBuilder (Lib, Node, globalutil) {
  'use strict';

  var Reader = require('./webappreadercreator')(Lib, Node, globalutil),
    Fs = Node.Fs,
    Path = Node.Path,
    q = Lib.q;

  function AppBuilder(devel, distro, path, symlinkinghints, verbose) {
    this.path =  path ? path : process.cwd();
    this.name = Path.basename(process.cwd());
    this.reader = null;
    this.mq = null;
    this.devel = devel;
    this.distro = distro;
    this.symlinkinghints = symlinkinghints;
    this.verbose = verbose;
  }

  AppBuilder.prototype.destroy = function () {
    this.verbose = verbose;
    this.symlinkinghints = null;
    if (this.mq) this.mq.destroy();
    this.mq = null;
    this.devel = null;
    if (this.reader) this.reader.destroy();
    this.reader = null;
    this.name = null;
    this.path = null;
    this.distro = null;
  };

  AppBuilder.prototype.info = function () {
    Array.prototype.unshift.call(arguments, this.name+':');
    Node.info.apply(null, arguments);
  };

  AppBuilder.prototype.install = function () {
    var err;
    try {
    this.reader = new Reader(this.path, {
      devel: this.devel,
      distro : this.distro,
      symlinkinghints: this.symlinkinghints,
      verbose: this.verbose
    });
    this.reader.go();
    this.info('Requirements satisfied, should go on ...');
    this.reader.finalize();
    } catch (e) {
      err = (e && e.message) ? new Error(e.message) : new Error(e.toString());
      return q.reject(err);
    }
    return q(true);
  };

  return AppBuilder;

}

module.exports = createAppBuilder;

