'use strict';

var Roose = require('./roose').Roose;

module.exports = function (redis_db) {
	Roose.Model.prototype.client = redis_db;
	return Roose;
};