/* jshint esnext:true, -W069, -W030 */
'use strict';

var LIB_PATH = process.env['ROOSE_COV'] ? '../lib-cov' : '../lib';

var expect = require('chai').expect
	, redis = require('redis')
	, client = redis.createClient()
	, Roose = require(LIB_PATH)(client)
	, Q = require('q')
	;

describe('Redis-oose tests:', function () {

	var Vehicle = new Roose.Model('vehicle', {
		'$manufacturer': 'string',
		'$model': 'string',
		'date_of_production': 'number',
		'colors': ['string | HexColor'],
		'wheels': ['number | Int']
	});

	describe('Invalid models', function () {
		it('No model name', function () {
			expect(function () {
				var tmp = new Roose.Model({
					'$name': 'string'
				});
			}).to.throw(/Model name unspecified/);
		});

		it('No primary key', function () {
			expect(function () {
				var tmp = new Roose.Model('test', {
					'name': 'string'
				});
			}).to.throw(/No primary key/);
		});

		it('Invalid array definition', function () {
			expect(function () {
				var tmp = new Roose.Model('test', {
					'$colors': ['string', 'string']
				});
			}).to.throw(/Invalid array definition/);
		});

		it('Invalid type: 1', function () {
			expect(function () {
				var tmp = new Roose.Model('test', {
					'$id': String
				});
			}).to.throw(/Invalid type.*'id'/);
		});

		it('Invalid type: 2', function () {
			expect(function () {
				var tmp = new Roose.Model('test', {
					'$id': 'lorem_ipsum'
				});
			}).to.throw(/Invalid type.*'id'/);
		});

		it('Invalid type: 3', function () {
			expect(function () {
				var tmp = new Roose.Model('test', {
					'$id': 'string | Loremipsum'
				});
			}).to.throw(/Invalid type.*'id'/);
		});
	});

	describe('Field value changed after object creation, then error', function () {
		var Car = new Roose.Model('car', {
			'$id': 'number'
		});

		var car = Car.create({
			'id': 7
		});

		it('Saves', function (done) {
			car.save()
				.then(function () {
					done();
				})
				.done();
		});

		it('Error on invalid value', function (done) {
			car.id = '7';
			var error = null;

			car.save().then(function () {
			}).fail(function (err) {
				error = err;
			}).fin(function () {
				expect(error).to.not.be.null;
				expect(error.message).to.match(/invalid.*'id'.*'car'/i);
				done();
			})
			.done();
		});
	});

	describe('Booleans', function () {
		var Car, c;

		it('Defines model', function () {
			Car = new Roose.Model('car', {
				'$id': 'number',
				'broken': 'boolean',
				'nice': 'boolean'
			});
		});

		it('Saves', function (done) {
			c = Car.create({
				id: 1,
				broken: true,
				nice: false
			});
			c.save().then(function () {
				done();
			}).done();
		});

		it('Gets', function (done) {
			Car.get({
				id: c.id
			}).then(function (car) {
				expect(car.broken).to.be.a('boolean');
				expect(car.id).to.equal(c.id);
				expect(car.nice).to.be.a('boolean');
				expect(car.nice).to.equal(c.nice);
				done();
			}).done();
		});
	});

	describe('Useful error messages', function () {
		it('Invalid type in instance', function () {
			expect(function () {
				var Model = new Roose.Model('test', {
					'$id': 'string',
					'sizes': ['number']
				});

				var instance = Model.create({
					'id': 'a',
					'sizes': 'b'
				});
			}).to.throw(/Invalid.*key.*sizes/);
		});
	});

	describe('No primitive type', function () {
		var Model = null;
		var instance = null;

		it('Defines', function () {
			Model = new Roose.Model('test', {
				'$id': 'string',
				'address': 'Url'
			});
		});

		it('Creates', function () {
			instance = Model.create({
				'id': 'a',
				'address': 'http://google.com'
			});
		});

		it('Saves', function (done) {
			instance.save().then(function () { done(); }).done();
		});

		it('Gets', function (done) {
			Model.get({'id': instance.id})
				.then(function (found) {
					expect(found).to.not.be.null;
					expect(found.id).to.equal(instance.id);
					expect(found.address).to.equal(instance.address);

					done();
				})
				.done();
		});
	});

	describe('Simple add/del', function () {
		var tesla = Vehicle.create({
			'manufacturer': 'Tesla',
			'model': 'Model S',
			'date_of_production': new Date().getTime(),
			'colors': ['#ff0000', '#00ff00', '#0000ff'],
			'wheels': [1, 2, 3, 4]
		});

		it('Saves', function (done) {
			Q.spawn(function* () {
				var teslaSaved = yield tesla.save();
				expect(teslaSaved.manufacturer).to.equal(tesla.manufacturer);
				expect(teslaSaved.model).to.equal(tesla.model);
				expect(teslaSaved.date_of_production).to.equal(tesla.date_of_production);
				expect(teslaSaved.colors.sort()).to.deep.equal(tesla.colors.sort());
				expect(teslaSaved.wheels.sort()).to.deep.equal(tesla.wheels.sort());
				done();
			});
		});

		it('Gets', function (done) {
			Q.spawn(function* () {
				var teslaRead = yield Vehicle.get({
					manufacturer: tesla.manufacturer,
					model: tesla.model
				});

				expect(teslaRead.manufacturer).to.equal(tesla.manufacturer);
				expect(teslaRead.model).to.equal(tesla.model);
				expect(teslaRead.date_of_production).to.equal(tesla.date_of_production);
				expect(teslaRead.colors.sort()).to.deep.equal(tesla.colors.sort());
				expect(teslaRead.wheels.sort()).to.deep.equal(tesla.wheels.sort());
				done();
			});
		});

		it('Removes', function (done) {
			Q.spawn(function* () {
				var id = {
					manufacturer: tesla.manufacturer,
					model: tesla.model
				};

				var teslaRead = yield Vehicle.get(id);
				expect(teslaRead.manufacturer).to.equal(tesla.manufacturer);

				var res = yield teslaRead.remove();
				expect(res).to.be.null;

				teslaRead = yield Vehicle.get(id);
				//expect(teslaRead).to.be.null;

				done();
			});
		});
	});

	describe('PX/EX option', function () {
		var mercedes = Vehicle.create({
			'manufacturer': 'Mercedes',
			'model': 'SLS',
			'date_of_production': new Date().getTime(),
			'colors': ['#ff0000', '#ffffff'],
			'wheels': [5, 6, 7, 8]
		});

		var id = {
			manufacturer: mercedes.manufacturer,
			model: mercedes.model
		};

		it('Saves with PX', function (done) {
			Q.spawn(function* () {
				var saved = yield mercedes.save({PX: 200});
				expect(saved).to.not.be.null;

				done();
			});
		});

		it('Exists after < 200 ms', function (done) {
			Q.spawn(function* () {
				yield Q.delay(100);
				var mercedesRead = yield Vehicle.get(id);
				expect(mercedesRead).to.not.be.null;
				expect(mercedesRead.manufacturer).to.equal(mercedes.manufacturer);
				expect(mercedesRead.model).to.equal(mercedes.model);
				expect(mercedesRead.date_of_production).to.equal(mercedes.date_of_production);
				expect(mercedesRead.colors.sort()).to.deep.equal(mercedes.colors.sort());
				expect(mercedesRead.wheels.sort()).to.deep.equal(mercedes.wheels.sort());

				done();
			});
		});

		it('Does not exist after ~300ms', function (done) {
			Q.spawn(function* () {
				yield Q.delay(200);
				var mercedesRead2 = yield Vehicle.get(id);
				expect(mercedesRead2).to.be.null;

				done();
			});
		});
	});

	describe('Array types', function () {
		var Student = new Roose.Model('student', {
			'$name': 'string',
			'teachers': ['string']
		});

		var s1 = {
			name: 'Jorge Luis Borges',
			teachers: ['Italo', 'Calvino']
		};

		it('Won\'t create mixed array', function () {
			expect(function () {
				Student.create({
					name: 'Jorge Luis Borges',
					teachers: ['Italo', 7]
				});
			}).to.throw(/teachers/);
		});

		it('Will create & save string array', function () {
			Q.spawn(function* () {
				var student;
				expect(function () {
					student = Student.create(s1);
				}).to.not.throw();

				var studentSaved = yield student.save();
				expect(studentSaved).to.not.be.null;
				expect(studentSaved.name).to.equal(s1.name);
				expect(studentSaved.teachers.sort()).to.equal(s1.teachers.sort());

				var studentRead = yield Student.get({name: 'Jorge Luis Borges'});
				console.log(s1, studentRead);
				expect(studentRead).to.not.be.null;
				expect(studentRead.name).to.equal(s1.name);
				expect(studentRead.teachers.sort()).to.deep.equal(s1.teachers.sort());
			});
		});
	});
});
