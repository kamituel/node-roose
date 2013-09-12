'use strict';

var util = require('util')
	, Q = require('q')
	, _ = require('lodash')
	, debug = require('debug')('roose')
	;

var Model = (function () {
	return function (name, spec) {
		/* jshint -W089 */
		/* Suppressing W089 warning which is to use Object.hasOwnProperty.
			Here, _spec contains database keys which will be persisted
			*AND* nothing else, thus I ommit hasOwnProperty to make 
			code cleaner. */

		var model = this;

		if (!name || typeof name !== 'string') {
			throw new Error('Model name unspecified');
		}

		Object.defineProperty(model, '_name', {
			configurable: false,
			enumerable: false,
			writeable: false,
			value: name	
		});

		var _schema = {};
		Object.keys(spec).forEach(function (key) {
			var isKey = false;
			var keySpec = spec[key];
			var arrayType = null;

			if (key.indexOf('$') === 0) {
				key = key.substring(1);
				isKey = true;
			}

			if (Array.isArray(keySpec)) {
				if (keySpec.length !== 1) {
					throw new Error('Invalid field length for "' + key + '"');
				}

				arrayType = keySpec[0];
			}

			_schema[key] = {
				type: keySpec,
				isKey: isKey,
				arrayType: arrayType
			};
		});

		// Make sure there is a primary key
		if (!_(_schema).any({isKey: true})) {
			throw new Error('No primary key specified');
		}

		Object.defineProperty(model, '_schema', {
			configurable: false,
			enumerable: false,
			writeable: false,
			value: _schema
		});

		debug('Model defined: ' + util.inspect(_schema));

		function validate (instance_spec) {
			for (var key in _schema) {
				if (!valid(_schema[key], instance_spec[key])) {
					return false;
				}
			}
			return true;

			function valid (definition, impl) {
				if (testPrimitive(definition.type, impl)) {
					return true;
				} else if (Array.isArray(definition.type) && Array.isArray(impl)) {
					return _(impl).every(function (item) {
						return testPrimitive(definition.arrayType, item);
					});
				} else {
					debug('Invalid instance spec: ' + impl + ' -> ' + typeof impl);
					return false;
				}

				function testPrimitive (type, val) {
					return ((type === String && typeof val === 'string')
						|| (type === Number && typeof val === 'number'));
				}
			}
		}

		this.get = function (spec) {
			var q = Q.defer();

			var dbKey = this.getDbKey(spec);
			var multi = model.client.multi();

			var asked = [];
			for (var k in _schema) {
				var method;
				if (_schema[k].arrayType !== null) {
					method = 'smembers';
				} else {
					method = 'get';
				}

				debug('DB.' + method + '(' + dbKey + k + ')');
				multi[method](dbKey + k);
				asked.push(k);
			}

			multi.exec(function (err, res) {
				if (err) {
					return q.reject(err);
				}

				console.log(res);

				var spec = {};
				for (var a = 0, l = asked.length; a < l; a += 1) {
					var key = asked[a];
					if (_schema[key].type === Number) {
						spec[key] = parseFloat(res[a]);
					} else if (Array.isArray(_schema[key].type)) {
						if (!Array.isArray(res[a])) {
							debug('Received ' + inspect(res[a]) + ' for key=' + key + ' but array expected');
							return q.resolve(null);
						}

						spec[key] = [];
						res[a].forEach(function (elem, i) {
							if (_schema[key].arrayType === Number) {
								spec[key][i] = parseFloat(res[a][i]);
							} else {
								spec[key][i] = res[a][i];
							}
						});
					} else {
						spec[key] = res[a];
					}
				}

				debug('Validating: ' + util.inspect(spec));
				if (validate(spec)) {
					q.resolve(new Instance(spec));
				} else {
					// Not found or invalid.
					q.resolve(null);
				}
			});

			return q.promise;
		};

		this.getKeyParts = function () {
			var keyParts = [];
			for (var k in _schema) {
				if (_schema[k].isKey) {
					keyParts.push(k);
				}
			}

			return keyParts.sort();
		};

		this.getDbKey = function (spec) {
			var keyParts = this.getKeyParts();

			console.log('kps', keyParts);

			var dbKey = _(keyParts).map(function (key) {
				if (!spec[key]) {
					debug('No key "' + key + '" specified');
				}

				return spec[key];
			});

			return model._name + ':' + dbKey.join('__') + ':';
		};

		var Instance = function (spec) {
			var instance = this;

			if (!validate(spec)) {
				throw new Error('Invalid object for type ' + model._name + ': ' + util.inspect(spec));
			}

			_(instance).assign(spec);

			debug('Instance created: ' + util.inspect(instance));
		};

		Instance.prototype.save = function (opts) {
			opts = opts || {};
			var instance = this;
			var q = Q.defer();

			debug('Saving: ' + util.inspect(this));

			var multi = model.client.multi();

			for (var key in _schema) {
				var val = this[key];
				var dbKey = instance.getKey() + key;

				var args = [dbKey, val];

				// We can't do sadd(key, val, EX, ...)
				// it's not supported by redis.
				if (_schema[key].arrayType === null) {
					if (opts.PX) {
						args.push('PX', opts.PX);
					} else if (opts.EX) {
						args.push('EX', opts.EX);
					}
				}

				var method;
				if (_schema[key].arrayType !== null) {
					method = 'sadd';
				} else {
					method = 'set';
				}

				debug('DB.' + method + '(' + args.join(',') + ')');
				multi[method].apply(multi, args);

				// Now set PX/EX for sadd
				if (_schema[key].arrayType !== null) {
					if (opts.PX) {
						multi.pexpire(dbKey, opts.PX);
					} else if (opts.EX) {
						multi.expire(dbKey, opts.EX);
					}
				}

			}

			multi.exec(function (err, res) {
				if (err) {
					return q.reject(err);
				}

				q.resolve(instance);
			});

			return q.promise;
		};

		Instance.prototype.remove = function () {
			var instance = this;
			var q = Q.defer();

			debug('Removing: ' + util.inspect(instance));
			var multi = model.client.multi();

			var dbKey = this.getKey();
			for (var key in _schema) {
				debug('DB.del(' + dbKey + key + ')');
				multi.del(dbKey + key);
			}

			multi.exec(function (err, res) {
				if (err) {
					return q.reject(err);
				}

				q.resolve(null);
			});

			return q.promise;
		};

		Instance.prototype.getKey = function () {
			return model.getDbKey(this);
		};

		return {
			create: function (spec) {
				return new Instance(spec);
			},
			get: model.get.bind(model)
		};
	};
})();

var Roose = {
	Model: Model
};
exports.Roose = Roose;

