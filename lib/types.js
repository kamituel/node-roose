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

	define({
		name: 'boolean',
		type: Boolean
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

	function getValidationCommand (type_spec) {
		if (getPrimitive(type_spec) !== null) {
			return function (val) {
				return (type_spec === 'string' && typeof val === 'string')
					|| (type_spec === 'number' && typeof val === 'number')
					|| (type_spec === 'boolean' && typeof val === 'boolean');
			};
		} else if (isRegex(type_spec)) {
			try {
				var regexp = new RegExp(type_spec.substring(1).substring(0, type_spec.length - 2));
				return function (val) {	
					return regexp.test(val);
				};
			} catch (e) {
				if (e instanceof SyntaxError) {
					return null;
				}
				throw e;
			}
		} else {
			var method = implyValidatorFunction(type_spec);

			if (method !== null) {
				return function (val) {
					var valid = new Validator();
					valid.check(val)[method]();
					return !(valid.getErrors() && valid.getErrors().length > 0);
				};
			}
		}

		return null;
	}

	function implyValidatorFunction (name) {
		if (validatorDefined('is' + name)) {
			return 'is' + name;
		}

		if (validatorDefined(name)) {
			return name;
		}

		return null;

		function validatorDefined (funcName) {
			var method = new Validator().check('some random value')[funcName];
			return method && typeof method === 'function';
		}
	}

	function isRegex (type_spec) {
		return type_spec.indexOf('/') === 0 && type_spec.lastIndexOf('/') === type_spec.length - 1;
	}

	function isValidDefinition (type_spec) {
		var typeParts = getTypeParts(type_spec);

		return _(typeParts).every(function (type) {
			return getValidationCommand(type) !== null;
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

			if (!getValidationCommand(type)(val)) {
				return false;
			}
		}

		return true;
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
			} else if (primitive === Boolean) {
				if (ele === 'true') {
					return true;
				} else if (ele === 'false') {
					return false;
				} else {
					return null;
				}
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