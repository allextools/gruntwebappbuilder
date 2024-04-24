function createBuild (Lib, Node, globalutil) {
  'use strict';

  var util = Lib.extend(require('./utilcreator')(Lib, Node), globalutil),
    Component = require('allex_protoboardhelperssdklib')(Lib),
    AppBuilder = require('./appbuildercreator')(Lib, Node, util),
    Interpreter = require('./webappinterpretercreator')(Lib, Node),
    Q = Lib.q,
    AllexQ = Lib.qlib,
    App = null;

  function ensurePackageJson (dir) {
    var cwd = process.cwd(),
      mydir = dir || process.cwd();
    if (cwd !== mydir) {
      process.chdir(mydir);
    }
    if (Node.Fs.fileExists('package.json')) {
      return Q(true);
    }
    Node.Fs.writeFileSync('package.json', JSON.stringify({
      name: Node.Path.basename(process.cwd()),
      description: 'WebApp',
      repository: 'N/A',
      license: 'MIT'
    }, null, 2));
    process.chdir(cwd);
    return Q(true);
  };


  function getField(field, obj) { return obj[field];}

  function buildWebapp(devel, rebuild, distro, path, symlinkinghints, verbose) {
    var jobs, job;
    App = new AppBuilder(devel, distro, path, symlinkinghints, verbose);
    jobs = [
      App.install.bind(App),
    ];
    Node.info('Building app: ',App.name);

    job = new AllexQ.PromiseExecutorJob(jobs);
    return job.go();
  }

  function buildGrunt (grunt, params) {
    var interpreter = new Interpreter(App.reader, grunt, params);
    interpreter.go();
    return Q.resolve(true);
  }

  function infoer (txt) {
    Node.info(txt);
    return Q(true);
  }

  function do_grunt (grunt, params) {

    var dir = params.pb_dir ? params.pb_dir : process.cwd();
    var jobs = [ 
      Node.Fs.remove.bind(Node.Fs, Node.Path.join(dir, '_generated_tmp')), 
      Node.Fs.remove.bind(Node.Fs, Node.Path.join(dir, 'node_modules', 'allexns')), 
      //Node.executeCommand.bind(Node, params.devel ? 'allex-bower-install' : 'bower install', null, {cwd:dir}, true),
      ensurePackageJson.bind(null, dir),
      infoer.bind(null, 'Clearing broken symlinks'),
      Node.executeCommand.bind(Node, 'find node_modules -type l -exec sh -c \'file -b "$1" | grep -q ^broken\' sh {} \\; -print | xargs rm -f', null, {cwd:dir}, true), //remove all broken symlinks
      infoer.bind(null, 'npm install --no-package-lock --no-save'),
      Node.executeCommand.bind(Node, 'npm install --no-package-lock --no-save', null, {cwd:dir}, true),
      buildWebapp.bind(null, params.devel, params.rebuild, params.distro, params.pb_dir, params.symlinkinghints, params.verbose),
      buildGrunt.bind(null, grunt, params)
    ];

    if (params.clean){
      jobs.unshift (Node.executeCommand.bind(Node, 'allex-webapp-clear', null, {cwd:dir}, true));
    }

    var job = new AllexQ.PromiseExecutorJob(jobs);
    var promise = job.go();
    promise.done(Node.info.bind(Node, 'Webapp sucessfully built'), Node.error.bind(Node, 'Webapp build failed due to: '));
    promise.done(null, process.exit.bind(process, 1));
    return promise;
  }

  return {
    grunt: do_grunt,
    GruntTasks: [
      'grunt-html-template',
      'grunt-contrib-symlink',
      'grunt-contrib-jshint',
      'grunt-mkdir',
      'grunt-file-exists',
      'grunt-template',
      'grunt-contrib-concat',
      'grunt-contrib-uglify', 
      'grunt-exec'
    ],
    tasklist: ['default']
  }
}

module.exports = createBuild;
