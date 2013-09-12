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
		'manufacturer': String,
		'model': String,
		'$date_of_production': Number,
		'$production_line': String,
		'colors': [String]
	});

	describe('Invalid models', function () {
		it('No model name', function () {
			expect(function () {
				new Roose.Model({
					'$name': String
				});
			}).to.throw(/Model name unspecified/);
		});

		it('No primary key', function () {
			expect(function () {
				new Roose.Model('test', {
					'name': String
				});
			}).to.throw(/No primary key/);
		});

		it('Invalid array definition', function () {
			expect(function () {
				new Roose.Model('test', {
					'$colors': [String, String]
				});
			}).to.throw(/Invalid field length/);
		});
	});

	describe('Simple add/del', function () {
		var tesla = Vehicle.create({
			'manufacturer': 'Tesla',
			'model': 'Model S',
			'date_of_production': new Date().getTime(),
			'production_line': 'X2CDHA3',
			'colors': ['red', 'green', 'blue']
		});

		it('Saves', function (done) {
			Q.spawn(function* () {
				var teslaSaved = yield tesla.save();
				expect(teslaSaved.manufacturer).to.equal(tesla.manufacturer);
				expect(teslaSaved.model).to.equal(tesla.model);
				expect(teslaSaved.date_of_production).to.equal(tesla.date_of_production);
				expect(teslaSaved.production_line).to.equal(tesla.production_line);
				expect(teslaSaved.colors.sort()).to.deep.equal(tesla.colors.sort());
				done();
			});
		});

		it('Gets', function (done) {
			Q.spawn(function* () {
				var teslaRead = yield Vehicle.get({
					date_of_production: tesla.date_of_production,
					production_line: tesla.production_line
				});

				expect(teslaRead.manufacturer).to.equal(tesla.manufacturer);
				expect(teslaRead.model).to.equal(tesla.model);
				expect(teslaRead.date_of_production).to.equal(tesla.date_of_production);
				expect(teslaRead.production_line).to.equal(tesla.production_line);
				expect(teslaRead.colors.sort()).to.deep.equal(tesla.colors.sort());
				done();
			});
		});

		it('Removes', function (done) {
			Q.spawn(function* () {
				var id = {
					date_of_production: tesla.date_of_production,
					production_line: tesla.production_line
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
			'production_line': '76',
			'colors': ['#ff0000', '#ffffff']	
		});

		var id = {
			date_of_production: mercedes.date_of_production,
			production_line: mercedes.production_line
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
				expect(mercedesRead.production_line).to.equal(mercedes.production_line);
				console.log('actual', mercedesRead.colors, 'expected', mercedes.colors);
				expect(mercedesRead.colors.sort()).to.deep.equal(mercedes.colors.sort());

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
			'$name': String,
			'teachers': [String]
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
