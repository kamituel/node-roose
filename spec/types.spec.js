/* jshint esnext:true, -W069, -W030 */
'use strict';

var LIB_PATH = process.env['ROOSE_COV'] ? '../lib-cov' : '../lib';

var expect = require('chai').expect
	, Types = require(LIB_PATH + '/roose').Roose.Types
	;

describe('Types validation', function () {
	describe('Primitives', function () {
		it('numbers', function () {
			expect(Types.validate('number', '1')).to.be.false;
			expect(Types.validate('number', '1.1')).to.be.false;
			expect(Types.validate('number', '-1')).to.be.false;
			expect(Types.validate('number', 1)).to.be.true;
			expect(Types.validate('number', 1.1)).to.be.true;
			expect(Types.validate('number', -1)).to.be.true;
		});

		it('strings', function () {
			expect(Types.validate('string', [])).to.be.false;
			expect(Types.validate('string', {})).to.be.false;
			expect(Types.validate('string', /abc/)).to.be.false;
			expect(Types.validate('string', 1)).to.be.false;
			expect(Types.validate('string', true)).to.be.false;
			expect(Types.validate('string', '[]')).to.be.true;
		});
	});

	describe('Validator types', function () {
		it('emails', function () {
			expect(Types.validate('Email', 'lorem ipsum')).to.be.false;
			expect(Types.validate('Email', 'lorem@ipsum.com')).to.be.true;
		});

		it('URLs', function () {
			expect(Types.validate('Url', 'lorem ipsum')).to.be.false;
			expect(Types.validate('Url', 'lorem.ipsum.com')).to.be.true;
			expect(Types.validate('Url', 'http://lorem.ipsum.io')).to.be.true;
		}); 
	});

	describe('Complex types', function () {
		it('email - lowercase', function () {
			expect(Types.validate('Email | Lowercase', 'LOGIN@server.com')).to.be.false;
			expect(Types.validate('Email | Lowercase', 'login@server.com')).to.be.true;
		});

		it('email - lowercase - type coersion', function () {
			var Obj = function () {};
			Obj.toString = function () { return "login@server.com"; };
			expect(Types.validate('Email | Lowercase', Obj)).to.be.true;
			expect(Types.validate('Email | Lowercase | string', Obj)).to.be.false;
		});

		it('numbers - type coersion', function () {
			expect(Types.validate('Float', 5.5)).to.be.true;
			expect(Types.validate('Float', '5.5')).to.be.true;
			expect(Types.validate('Float | number', '5.5')).to.be.false;
			expect(Types.validate('Float | number', 5.5)).to.be.true;
		});
	});
});