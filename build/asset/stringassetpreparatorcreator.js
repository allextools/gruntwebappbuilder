function createStringAssetPreparator (lib, Node) {
  'use strict';

  var Fs = Node.Fs,
    Path = Node.Path,
    util = require('./utilcreator')(lib, Node),
    dirIsModuleDir = util.dirIsModuleDir,
    protoboardAt = util.protoboardAt,
    nextWalkStep = util.nextWalkStep;

  function StringAssetPreparator (reader, assetstring) {
    this.reader = reader;
    this.assetpath = assetstring.split('/');
    this.destpath = this.assetpath.slice();
    this.walkpath = [this.reader.cwd];
    this.modulepath = null;
    this.moduledistpath = null;
    this.didInstall = false;
    this.componentName = null;
  }
  StringAssetPreparator.prototype.destroy = function () {
    if (this.reader) {
      process.chdir(this.reader.cwd);
    }
    this.componentName = null;
    this.didInstall = null;
    this.moduledistpath = null;
    this.modulepath = null;
    this.walkpath = null;
    this.destpath = null;
    this.assetpath = null;
    this.reader = null;
  };
  StringAssetPreparator.prototype.go = function () {
    var testdir,
      testcommand,
      tochdir;
    testdir = this.makeAStep();
    testcommand = this.assetpath.length>0 ? 'dirExists' : 'existsSync';
    if (!testdir) {
      console.log('walkpath', this.walkpath, 'assetpath', this.assetpath, 'no next step?');
      process.exit(0);
    }
    if (!Fs[testcommand](testdir)) {
      if (this.componentName) {
        this.reader.error('Could not find '+testdir+' in module '+this.componentName);
        return null;
      }
      if (this.didInstall) {
        this.reader.error('Could not find '+testdir+' even after installation of '+this.didInstall);
        return null;
      }
      //console.log('will install because', testcommand, 'failed in', process.cwd(), 'for', testdir);
      if (this.reader.trySymLinkModule(testdir)) {
        this.didInstall = testdir;
      } else if (!this.doInstall(testdir)) {
        return null;
      }
      if (!Fs[testcommand](testdir)) { //installation did not give me the needed testdir
        this.reader.error('After installation of module '+testdir+', '+testdir+' does not '+testcommand+' in '+process.cwd());
        //this.reader.error('Installation of module '+testdir+' did not produce the directory '+testdir+' in '+process.cwd());
        return null;
      }
    }
    if (this.assetpath.length < 1) {
      if (this.destpath.length>0) {
        this.destpath[0] = this.firstDestPathSegment();
      }
      return this.returnAndDie();
    }
    return this.go();
  };
  StringAssetPreparator.prototype.makeAStep = function () {
    var hadnopb, maybestep, testdir, tochdir;
    hadnopb = !this.protoboard;
    maybestep = this.assetpath.shift();
    tochdir = this.walkpath[this.walkpath.length-1];
    if (Fs.dirExists(tochdir)) {
      this.doChdir(tochdir);
    }
    testdir = nextWalkStep(maybestep);
    if (!testdir) {
      this.reader.error('No next step, currently in '+process.cwd()+', on '+maybestep+', walkpath up to now: '+this.walkpath.join('/')+', assetpath: '+this.assetpath.join('/'));
      this.destroy();
    }
    if (testdir === process.cwd()) {
      this.reader.error('Next StringAssetPreparator walk step in '+process.cwd()+', for '+maybestep+', resulted in my same directory, walkpath up to now: '+this.walkpath.join('/')+', assetpath: '+this.assetpath.join('/'));
      this.destroy();
    }
    if (hadnopb && this.protoboard && this.searchGroup==='js' && lib.isArray(this.protoboard.actualtarget)) {
      maybestep = this.handleActualTarget(maybestep);
    }
    if (testdir === maybestep) {
      this.walkpath.push(testdir);
      return testdir;
    }
    this.doChdir(testdir);
    this.walkpath.push(testdir);
    this.walkpath.push(maybestep);
    return this.makeAStep();
  };
  StringAssetPreparator.prototype.doInstall = function (modulename) {
    var installstring, nsfile;
    if (!(lib.isArray(this.destpath) && this.destpath.length>0 && this.destpath[0] === 'node_modules')) {
      this.reader.error('Installing '+modulename+' via npm will do no good, because '+modulename+' will not show up in node_modules, giving up');
      return false;
    }
    installstring = (this.reader.pb_data.installResolution && this.reader.pb_data.installResolution[modulename]) ? this.reader.pb_data.installResolution[modulename] : modulename;
    this.didInstall = modulename;
    if (modulename === 'allexns') {
      nsfile = Fs.readJSONSync(Path.join(Node.getNamespacePath(), '.allexns.json'));
      Fs.ensureDirSync(Path.join('allexns'));
      Fs.writeFileSync(Path.join('allexns', 'ns.js'), "window['.allexns.js'] = "+JSON.stringify(nsfile, null, 2)+";\n");
      Fs.writeFileSync(Path.join('allexns', 'package.json'), JSON.stringify({
        name: 'allexns',
        private: true
      }, null, 2));
      return true;
    }
    Node.info('npm installing '+modulename+(installstring!==modulename ? (' ('+installstring+')') : ''));
    return Node.executeCommandSync('npm install --save '+installstring, {});
  };
  StringAssetPreparator.prototype.doChdir = function (dir) {
    if ((dir !== this.reader.cwd) && dirIsModuleDir(dir)) {
      this.componentName = dir;
      this.modulepath = this.walkpath.slice(1);
      if (!this.checkForProtoboard(dir)) {
        this.moduledistpath = this.walkpath.slice(1);
      }
    } else if (this.checkForProtoboard(dir)) {
      this.modulepath = this.walkpath.slice(1).concat(dir); //again, now because of found protoboard
    }
    process.chdir(dir);
  };
  StringAssetPreparator.prototype.checkForProtoboard = function (dir) {
    if (!(this.walkpath && this.walkpath.length>1)) {
      return false;
    }
    var pb = protoboardAt(dir);
    if (!pb) {
      return false;
    }
    this.moduledistpath = this.walkpath.slice(1);
    this.protoboard = pb;
    return true;
  };
  StringAssetPreparator.prototype.firstDestPathSegment = function () {
    var fdpso, public_dirs;
    if (this.componentName) {
      return 'components';
    }
    public_dirs = (this.reader && this.reader.pb_data && lib.isArray(this.reader.pb_data.public_dirs)) ? 
      this.reader.pb_data.public_dirs
      :
      [];
    fdpso = this.destpath[0];
    if (public_dirs.indexOf(fdpso) >= 0) {
      return fdpso;
    }
    return this.searchGroup;
  };
  StringAssetPreparator.prototype.moduleDistPath = function () {
    var mdp;
    if (!(lib.isArray(this.moduledistpath))) {
      return null;
    }
    mdp = this.moduledistpath.slice();
    mdp[0] = this.firstDestPathSegment();
    return Path.join.apply(Path, mdp);
  };
  StringAssetPreparator.prototype.returnAndDie = function () {
    var myret = {
      component: this.componentName,
      src_path: Path.join.apply(Path, this.walkpath),
      dest_path: Path.join.apply(Path, this.destpath),
      module_path: Path.join.apply(Path, this.modulepath),
      module_dist_path: this.moduleDistPath(),
      protoboard: this.protoboard,
      resolved: true
    },
      ret = this.finalReturnProc(myret);
    this.destroy();
    return ret;
  };
  StringAssetPreparator.prototype.handleActualTarget = function () {
    throw new Error('Not implemented');
  };
  StringAssetPreparator.prototype.finalReturnProc = function () {
    throw new Error('Not implemented');
  };


  return StringAssetPreparator;
}

module.exports = createStringAssetPreparator;
