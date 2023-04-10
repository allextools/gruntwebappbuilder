function createPageCompile (Lib, Node, recognizeModule) {
  'use strict';
  var Path = Node.Path,
    Fs = Node.Fs;

  function jsscripttagToFile (target, item) {
    Fs.writeFileSync (target, "<script type='text/javascript' src='"+item+"'></script>\n", {flag:'a'});
  }

  function cssTagsToFile (target, item) {
    if (item.match(/\:\/\//)) throw new Error('No Global links allowed : '+item);
    if (item.charAt(0) === '/') throw new Error ('No root links allowed :'+item);
    Fs.writeFileSync (target, "<link rel='stylesheet' type='text/css' href='"+item+"'>\n", {flag:'a'});
  }

  function assetFinder (pb_data, rootdir, assetdir, page_name, origasset) {
    var asset, objasset, i;
    if (!Lib.isString(origasset)) {
      objasset = {};
      for (i in origasset) {
        if (!origasset.hasOwnProperty(i)) {
          continue;
        }
        objasset[i] = assetFinder(pb_data, rootdir, assetdir, page_name, origasset[i]);
      }
      return origasset;
    }
    asset = recognizeModule(origasset, pb_data);
    if (Fs.fileExists(Path.resolve(rootdir, assetdir, page_name, asset))) {
      return Path.join(assetdir, page_name, asset);
    }
    if (Fs.fileExists(Path.resolve(rootdir, assetdir, asset))) {
      return Path.join(assetdir, asset);
    }
    if (Fs.fileExists(Path.resolve(rootdir, asset))) {
      return Path.join(asset);
    }
    return asset;
  }

  function go(cwd, variant) {
      var page_name = Path.basename(cwd),
      ///TODO: first pass: let pb_dir be detected this way ...
      pb_dir = Path.resolve(cwd, '..', '..'),
      allex_dev_dir = Path.resolve(pb_dir, 'allexdev'),
      inline_js = null,
      inline_css = null,
      target_file = Path.resolve(pb_dir, 'pages', page_name+'.swig'),
      pb_file = Path.resolve(pb_dir, 'protoboard.json'),
      allex_dev_path = Path.resolve(pb_dir, 'allexdev', page_name+'.js'),
      local_scripts_file = Path.resolve(cwd,'./scripts.js'),
      local_css_file = Path.resolve(cwd,'./csslinks.js'),
      local_post_scripts_file = Path.resolve(cwd, './post_scripts.js');


    var body_file = Path.resolve(cwd, variant ? 'body_'+variant+'.html': 'body.html'),
      head_file = Path.resolve (cwd, variant ? 'head_'+variant+'.html' : 'head.html');

    if (!Fs.fileExists(body_file)) {
      Node.warn (body_file+' does not exist, using default instead');
      body_file = Path.resolve(cwd, 'body.html');
    }

    if (!Fs.fileExists(pb_file)) {
      throw new Error('Unable to find protoboard.json: '+pb_file);
    }

    if (!Fs.fileExists(allex_dev_path)) {
      throw new Error('Unable to find allexdev file '+allex_dev_path);
    }

    var allex_data = Fs.fileExists(allex_dev_path) ? require(allex_dev_path) : {},
      lscripts = Fs.fileExists(local_scripts_file) ? require(local_scripts_file) : [],
      lcss = Fs.fileExists(local_css_file) ? require(local_css_file) : [],
      pb_data = Fs.readJSONSync(pb_file),
      lpscripts = Fs.fileExists(local_post_scripts_file) ? require (local_post_scripts_file) : [];

    if (!allex_data.js) allex_data.js = [];
    if (!allex_data.css) allex_data.css = [];
    if (!pb_data.pages) pb_data.pages = {};
    if (!pb_data.pages[page_name]) pb_data.pages[page_name] = {};
    if (pb_data.installResolution) {
      pb_data.installResolution = {};
    }

    lscripts = lscripts.map(assetFinder.bind(null, pb_data, pb_dir, 'js', page_name));
    lcss = lcss.map(assetFinder.bind(null, pb_data, pb_dir, 'css', page_name));

    pb_data.pages[page_name].js = (lscripts.concat(allex_data.js.map(assetFinder.bind(null, pb_data, pb_dir, 'js', page_name)))).concat(lpscripts);
    //pb_data.pages[page_name].css= lcss.concat(allex_data.css.map(assetFinder.bind(null, pb_data, pb_dir, 'css', page_name)));
    pb_data.pages[page_name].css= {
      pre: lcss,
      post: allex_data.css.map(assetFinder.bind(null, pb_data, pb_dir, 'css', page_name))
    };
    pb_data.pages[page_name].vars = allex_data.vars;
    pb_data.pages[page_name].public_dirs = allex_data.public_dirs;
    pb_data.pages[page_name].template = allex_data.template;

    var layout = pb_data.pages[page_name].layout && pb_data.pages[page_name].layout[variant] ? pb_data.pages[page_name].layout[variant] : 'designer';

    Fs.writeFileSync (target_file, "{% extends '../layouts/"+layout+".html' %}\n{% block content %}{% raw %}");
    Fs.writeFileSync (target_file, Fs.readFileSync(body_file), {flag: 'a'});
    if (pb_data.pages[page_name].vars && pb_data.pages[page_name].vars.serviceworker) {
      Fs.writeFileSync (target_file, "<script>if ('serviceWorker' in navigator) {navigator.serviceWorker.register('/"+page_name+".serviceworker.js');}</script>", {flag:'a'});
    }
    Fs.writeFileSync (target_file, '{% endraw %}{% endblock %}', {flag:'a'});

    Fs.writeJSONSync(pb_file, pb_data);
    return {
      pb_file : pb_file,
      pb_data : pb_data,
      pb_dir : pb_dir
    };
  }

  function isDir(cwd,item){
    var f = Path.resolve(cwd, 'pages', item),
      stat = Fs.lstatSync(f);
    return stat.isDirectory();
  }

  function toJSFilename (file) {
    if (Path.extname(file) !== '.js') return null;
    return Path.basename(file, '.js');
  }

  function findAndGo (cwd, variant) {
    if (!Fs.dirExists(Path.join(cwd, 'pages'))) throw new Error('No pages dir in '+cwd);
    var pp = Fs.readdirSync (Path.join (cwd, 'allexdev')).map (toJSFilename).filter (Lib.isNotNull);
    for (var i in pp){
      Node.info('About to compile page', pp[i]);
      if (!isDir(cwd, pp[i])) continue;
      if (pp[i].charAt(0) === '.') continue;
      go (Path.resolve(cwd, 'pages', pp[i]), variant);
    }
  }

  return {
    go : go,
    findAndGo : findAndGo
  };

}

module.exports = createPageCompile;
