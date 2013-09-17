'use strict';

var _ = require('lodash')
	, Validator = require('validator').Validator
	, _h = require('./helper')
	;

Validator.prototype.error = function (msg) {
	this._errors.push(msg);
	return this;
};

Validator.prototype.getErrors = function () {
	return this._errors;
};

var Types = (function () {
	var _types = [];
	var _typeNames = [];

	define({
		name: 'string',
		type: String
	});

	define({
		name: 'number',
		type: Number
	});

	function define (spec) {
		if (!spec.name) {
			throw new Error('Type spec does not include a type name.');
		}

		if (_(_types).contains({name: spec.name})) {
			throw new Error('Type ' + _h.q(spec.name) + ' is already defined.');
		}

		_types.push(spec);
		_typeNames = _(_types).pluck('name').valueOf();
	}

	function isValidDefinition (type_spec) {
		var typeParts = getTypeParts(type_spec);

		var valid = new Validator();
		return _(typeParts).every(function (type) {
			if (getPrimitive(type)) {
				return true;
			}

			var method = valid.check('some random value')['is' + type];
			if (!method || typeof method !== 'function') {
				return false;
			}

			return true;
		});
	}

	function getTypeParts (type_spec) {
		return type_spec.replace(/\s/g, '').split('|');
	}

	function validate (type_spec, val) {
		//debug('Validating type ' + util.inspect(type_spec));

		var types = getTypeParts(type_spec);
		for (var t = 0, len = types.length; t < len; t += 1) {
			var type = types[t];

			if (!validateOne(type)) {
				return false;
			}
		}

		return true;

		function validateOne (type) {
			var valid = new Validator();
			var validMethods = [];

			var spec = _(_types).find({name: type});
			if (!spec) {
				var validFunc = valid.check(val)['is' + type];
				if (typeof validFunc === 'function') {
					//debug('Type ' + _q(type) + ' derived from Validator');
					validMethods.push('is' + type);
				} else {
					throw new Error('Type not known: ' + _h.q(type));
				}
			} else {
				if (spec.type) {
					if (spec.type === String && typeof val !== 'string' ||
						spec.type === Number && typeof val !== 'number') {
						return false;
					}
				}

				if (spec.validator) {
					validMethods = validMethods.concat(spec.validator);
				}
			}

			for (var v = 0, len = validMethods.length; v < len; v += 1) {
				var method = validMethods[v];
				valid.check(val)[method]();
			}

			if (valid.getErrors() && valid.getErrors().length > 0) {
				return false;
			} else {
				return true;
			}
		}
	}

	function getPrimitive (type_spec) {
		var res = _.intersection(_typeNames, getTypeParts(type_spec));
		if (res.length === 1) {
			var type = _(_types).find({name: res[0]});
			return type.type;
		}
		return null;
	}

	function parse (type_spec, val) {
		if (Array.isArray(type_spec.type)) {
			return _(val).map(function (ele) {
				return parsePrimitive(type_spec.type[0], ele);
			}).valueOf();
		} else {
			return parsePrimitive(type_spec.type, val);
		}

		function parsePrimitive (type_spec, ele) {
			var primitive = getPrimitive(type_spec);
			if (primitive === String) {
				return ele;
			} else if (primitive === Number) {
				return parseFloat(ele);
			} else if (primitive === null) {
				// No primitive defined. It's okay.
				return ele;
			} else {
				throw new Error('Unknown primitive type=' + primitive + ' for spec ' + type_spec);
			}
		}
	}

	return {
		validate: validate,
		parse: parse,
		isValidDefinition: isValidDefinition
	};
})();

module.exports = Types;