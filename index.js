'use strict';

var walkSync = require('walk-sync');
var FSTree = require('fs-tree-diff');
var mkdirp = require('mkdirp');
var fs = require('fs');
var debug = require('debug')('tree-sync');

module.exports = TreeSync;

function TreeSync(input, output) {
  this._input = input;
  this._output = output;
  this._hasSynced = false;
  this._lastInput = FSTree.fromEntries([]);

  debug('initializing TreeSync:  %s -> %s', this._input, this._output);
}

TreeSync.prototype.sync = function() {
  mkdirp.sync(this._output);
  mkdirp.sync(this._input);

  debug('syncing %s -> %s', this._input, this._output);

  var input = FSTree.fromEntries(walkSync.entries(this._input));
  var output = FSTree.fromEntries(walkSync.entries(this._output));

  debug('walked %s %dms and  %s %dms', this._input, input.size, this._output, output.size);

  var isFirstSync = !this._hasSynced;
  var operations = output.calculatePatch(input).filter(function(operation) {
    if (operation[0] === 'change') {
      return isFirstSync;
    } else {
      return true;
    }
  });

  var inputOperations = this._lastInput.calculatePatch(input).filter(function(operation) {
    return operation[0] === 'change';
  });

  this._lastInput = input;

  operations = operations.concat(inputOperations);

  debug('calc operations %d', operations.length);

  operations.forEach(function(patch) {
    var operation = patch[0];
    var pathname = patch[1];

    var inputFullpath = this._input + '/' + pathname;
    var outputFullpath = this._output + '/' + pathname;

    switch(operation) {
      case 'create' :
        return fs.writeFileSync(outputFullpath, fs.readFileSync(inputFullpath));
      case 'change' :
        return fs.writeFileSync(outputFullpath, fs.readFileSync(inputFullpath));
      case 'mkdir' :
        try {
          return fs.mkdirSync(outputFullpath);
        } catch(e) {
          if (e && e.code === 'EXISTS') { /* do nothing */ }
          else { throw e; }
        }
      case 'unlink':
        try {
          return fs.unlinkSync(outputFullpath);
        } catch(e) {
          if (e && e.code === 'ENOENT') { /* do nothing */ }
          else { throw e; }
        }
      case 'rmdir':
        return fs.rmdir(outputFullpath);
      default:
        throw TypeError('Unknown operation:' + operation + ' on path: ' + pathname);
    }
  }, this);

  this._hasSynced = true;
  debug('applied patches: %d', operations.length);
};
