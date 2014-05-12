var http = require('http'),
    async = require('async'),
    argv = require('minimist')(process.argv.slice(2)),
    baseOptions = {
      host: 'us.battle.net',
      port: 80,
      path: null,//'/api/d3/profile/oldmanklc-1949/',
      method: 'GET'
    },
    battleTagHash,
    profile,
    characters,
    basePaths,
    getRequest = function(options, callback) {
      var dataSet = '';
      http.get(options, function(res) {
        res.setEncoding('utf8');
        res.on('data',function(chunk){
          dataSet += chunk;
        });
        res.on('end',function(){
          dataSet = JSON.parse(dataSet);
          callback(null,dataSet);
        });
      }).on('error', function(e) {
        callback('problem with request: ' + e.message);
      });
    }; 

async.series({
  validateInput:function(callback){
    battleTagHash = argv.b;
    callback(!argv.b && 'Must provide -b argument as <battleTag>#<BattleCode>',
            'BattleHash =' + battleTagHash);
  },
  constructBasePaths:function(callback) {
    basePaths = {
      profile:'/api/d3/profile/' + battleTagHash + '/',
      character:'/api/d3/profile/' + battleTagHash + '/hero/',
      item:'/api/d3/data/' // item/<item hash code>
    };
    callback();
  },
  gatherProfile:function(callback){
    var options = baseOptions,
        req;
    options.path = basePaths.profile;
    getRequest(options, function(err,data) {
      profile = data;
      callback(err);
    });
  },
  gatherCharacters:function(callback){
    var options = baseOptions;
    characters = [];
    async.each(profile.heroes,function(character,aCallback){
      options.path = basePaths.character + character.id;
      getRequest(options, function(err,data){
        characters.push(data);
        aCallback(err);
      });
    },function(err){
        callback(err);
    });
  },
  gatherItemStatsForEachCharacterItem:function(callback){
    //TODO: Account For Gem Stats
    var options = baseOptions;
    async.each(characters,function(character,aCallback){
      async.each(Object.keys(character.items),function(key,bCallback){
        options.path = basePaths.item + character.items[key].tooltipParams;
        getRequest(options,function(err,data){
          character.items[key].gems = data.gems;
          character.items[key].attributesRaw = data.attributesRaw;
          bCallback(err);
        });
      },aCallback);
    },callback);
  },
  report:function(callback){
    var stats, items, item, rawAttrs;
    function addStats(attributes) {
      var attrKeys = Object.keys(attributes);
      attrKeys.forEach(function(key){
        if(stats[key]) {
          stats[key].min += attributes[key].min;
          stats[key].max += attributes[key].max;
        } else {
          stats[key] = attributes[key];
        }
      });
    }
    characters.forEach(function(character){
      stats = {};
      items = character.items;
      Object.keys(items).forEach(function(itemKey){
        item = items[itemKey];
        addStats(item.attributesRaw);
        item.gems.forEach(function(gem){
          addStats(gem.attributesRaw);
        });
      });
      console.log('=====' + character.name + '=====');
      console.log(stats);
    });
    callback();
  }
},function(err,results) {
  if(err) {
    console.log(err);
  }
});