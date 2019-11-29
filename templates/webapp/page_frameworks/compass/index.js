var swig = require('hersswig'),
  Path = require ('path'),
  RTToolbox = require('allex-rt-toolbox'),
  Fs = RTToolbox.node.Fs ;

function load (cwd, page) {
  var target_dir = Path.resolve (cwd, 'scss', page);
  if (Fs.dirExists(target_dir)) {
    return q.reject (new Error ('Path already exists: ', target_dir));
  }

  Fs.ensureDirSync (target_dir);
  Fs.copySync (Path.resolve (__dirname, 'assets', 'sass'), Path.resolve(target_dir));

  var template = swig.compileFile (Path.resolve (__dirname, 'config.rb'));
  Fs.writeFileSync (Path.resolve (target_dir, 'config.rb'),  template ({
    page: page
  }), 'utf8');
}


module.exports = load;
