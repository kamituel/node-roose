/* jshint -W089 */
/* Suppressing W089 warning which is to use Object.hasOwnProperty.
	Here, _spec contains database keys which will be persisted
	*AND* nothing else, thus I ommit hasOwnProperty to make 
	code cleaner. */
'use strict';

var util = require('util')
	, Q = require('q')
	, _ = require('lodash')
	, debug = require('debug')('roose')
	, _h = require('./helper')
	, Types = require('./types')
	;

var Instance = function (model, spec) {
	var instance = this;
	this._model = model;

	var validationResult = model.validate(spec);
	if (!validationResult.valid) {
		throw new Error('Invalid value for key ' + _h.q(validationResult.key) + 
			' in type ' + _h.q(model._name));
	}

	_(instance).assign(spec);

	//debug('Instance created: ' + util.inspect(instance));
};

Instance.prototype.save = function (opts) {
	opts = opts || {};
	var instance = this;
	var q = Q.defer();

	debug('Saving: ' + util.inspect(this));

	var multi = this._model.client.multi();

	for (var key in this._model._schema) {
		var val = this[key];
		var dbKey = instance.getKey() + key;

		var args = [dbKey, val];

		// We can't do sadd(key, val, EX, ...)
		// it's not supported by redis.
		if (this._model._schema[key].arrayType === null) {
			if (opts.PX) {
				args.push('PX', opts.PX);
			} else if (opts.EX) {
				args.push('EX', opts.EX);
			}
		}

		var method;
		if (this._model._schema[key].arrayType !== null) {
			method = 'sadd';
		} else {
			method = 'set';
		}

		debug('DB.' + method + '(' + args.join(',') + ')');
		multi[method].apply(multi, args);

		// Now set PX/EX for sadd
		if (this._model._schema[key].arrayType !== null) {
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
	var multi = this._model.client.multi();

	var dbKey = this.getKey();
	for (var key in this._model._schema) {
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
	return this._model.getDbKey(this);
};

var Model = (function () {
	return function (name, spec) {
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
					throw new Error('Invalid array definition for "' + key + '"');
				}

				arrayType = keySpec[0];
			}

			// Check if type spec is valid
			var tSpec = arrayType || keySpec;
			if (typeof tSpec !== 'string' || !Types.isValidDefinition(tSpec)) {
				throw new Error('Invalid type for key ' + _h.q(key));
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

		//debug('Model defined: ' + util.inspect(_schema));

		this.validate = function (instance_spec) {
			for (var key in _schema) {
				if (!valid(_schema[key], instance_spec[key])) {
					return {valid: false, key: key};
				}
			}
			return {valid: true};

			function valid (definition, impl) {
				if (Array.isArray(definition.type)) {
					if (Array.isArray(impl)) {
						return _(impl).every(function (item) {
							return Types.validate(definition.type[0], item);
						});
					} else {
						return false;
					}
				} else {
					return Types.validate(definition.type, impl);
				}
			}
		};

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

				debug('get() result: ' + util.inspect(res));

				var spec = {};
				for (var a = 0, l = asked.length; a < l; a += 1) {
					var key = asked[a];
					spec[key] = Types.parse(_schema[key], res[a]);
				}

				debug('Validating: ' + util.inspect(spec));
				if (model.validate(spec).valid) {
					q.resolve(new Instance(model, spec));
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

			var dbKey = _(keyParts).map(function (key) {
				if (!spec[key]) {
					debug('No key "' + key + '" specified');
				}

				return spec[key];
			});

			return model._name + ':' + dbKey.join('__') + ':';
		};

		return {
			create: function (spec) {
				return new Instance(model, spec);
			},
			get: model.get.bind(model)
		};
	};
})();

var Roose = {
	Model: Model,
	Types: Types
};
exports.Roose = Roose;
