'use strict';
var MANDATORY_DIRS = [
    'allexdev',
    'css',
    'js',
    'pages'
  ];


function createWebAppInit (lib, Node) {
  'use strict';
  var  Q = lib.q,
    Fs = Node.Fs,
    Path = Node.Path;

  function resolvePath (dirname, path) {
    return Path.resolve(dirname, path);
  }

  function dirCreator (basedirname, dirname) {
    Fs.ensureDirSync(resolvePath(basedirname, dirname));
  }

  function init (dirname, frameworks) {

    dirname = Path.resolve(process.cwd(), dirname);

    //TODO: skip this one if force is given
    if (Fs.dirExists (dirname)){
      throw new Error ('webapp '+dirname+' already exists');
    }

    Fs.recreateDir(dirname);

    var sdk_common = Path.resolve (__dirname, '..', 'templates', 'webapps'),
      template_root = Path.resolve(__dirname, '..', 'templates', 'webalizer', 'web'),
      framework_root = Path.resolve(__dirname, '..', 'templates', 'webapp', 'frameworks');

    Fs.copySync (Path.join (template_root, '*'), dirname);
    Fs.symlinkSync (Path.join (sdk_common, 'layouts'), Path.join (dirname, 'layouts'));
    Fs.symlinkSync (Path.join (sdk_common, 'includes'), Path.join (dirname, 'includes'));

    MANDATORY_DIRS.forEach(dirCreator.bind(null, dirname));
    process.chdir(dirname);
    //Bower.commands.link();


    var framework_path = null;

    if (frameworks) {
      for (var i = 0; i < frameworks.length; i++) {
        framework_path = Path.resolve(framework_root, frameworks[i]);
        if (!Fs.dirExists(framework_path)) throw new Error ('Unknown framework: '+frameworks[i]);
        Fs.ensureDirSync (Path.resolve (dirname, 'frameworks'));
        Fs.symlinkSync (framework_path, Path.resolve (dirname, 'frameworks', frameworks[i]));
      }

      var pb = Fs.readJSONSync (Path.resolve(dirname, 'protoboard.json'));
      if (!pb.public_dirs) pb.public_dirs = [];
      if (pb.public_dirs.indexOf('frameworks') < 0) pb.public_dirs.push ('frameworks');
      Fs.writeJSONSync(Path.resolve(dirname, 'protoboard.json'),pb);
    }
  }

  return init;
}

module.exports = createWebAppInit;

