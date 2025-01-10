const { satisfies } = require('compare-versions');

module.exports.satisfies = function (version, range, options) {
  if (range === '*') {
    return true;
  }
  return satisfies(version, range);
}
