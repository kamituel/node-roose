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

			if (key.indexOf('$') === 0) {
				key = key.substring(1);
				isKey = true;
			}

			_schema[key] = {
				type: keySpec,
				isKey: isKey
			};
		});

		Object.defineProperty(model, '_schema', {
			configurable: false,
			enumerable: false,
			writeable: false,
			value: _schema
		});

		debug('Model defined: ' + util.inspect(model));

		function validate (instance_spec) {
			for (var key in _schema) {
				console.log('check', _schema[key], instance_spec[key]);
				if (!valid(_schema[key], instance_spec[key])) {
					return false;
				}
			}
			return true;

			function valid (definition, impl) {
				if (definition.type === String && typeof impl === 'string') {
					return true;
				} else if (definition.type === Number && typeof impl === 'number') {
					return true;
				} else if (impl instanceof definition.type) {
					return true;
				} else {
					debug('Invalid instance spec: ' + impl + ' -> ' + typeof impl);
					return false;
				}
			}
		}

		this.get = function (spec) {
			var q = Q.defer();

			var dbKey = this.getDbKey(spec);
			var multi = model.client.multi();

			var asked = [];
			for (var k in _schema) {
				debug('DB.get(' + dbKey + k + ')');
				multi.get(dbKey + k);
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
						spec[asked[a]] = parseFloat(res[a]);
					} else {
						spec[asked[a]] = res[a];
					}
				}

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

				for (var o in opts) {
					if (opts.hasOwnProperty(o)) {
						args.push(o);
						if (opts[o] !== null) {
							args.push(opts[o]);
						}
					}
				}

				debug('DB.set(' + args.join(',') + ')');
				multi.set.apply(multi, args);
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

