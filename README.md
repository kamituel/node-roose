node-roose
==========

Extremely simple, promise based Redis object modeling tool.

Usage
-----

The following:

```
var Vehicle = new Roose.Model('vehicle', {
	'manufacturer': String,
	'model': String,
	'$date_of_production': Number,       // properties starting with '$' will be keys in the Redis store.
	'$production_line': String
});

var tesla = Vehicle.create({
	'manufacturer': 'Tesla',
	'model': 'Model S',
	'date_of_production': new Date().getTime(),
	'production_line': 'X2CDHA3'
});	

tesla.save().done();

```

Translates into following Redis commands:

```
"MULTI"
"set" "vehicle:1378909097410__X2CDHA3:manufacturer" "Tesla"
"set" "vehicle:1378909097410__X2CDHA3:model" "Model S"
"set" "vehicle:1378909097410__X2CDHA3:date_of_production" "1378909097410"
"set" "vehicle:1378909097410__X2CDHA3:production_line" "X2CDHA3"
"EXEC"
```

Tests
-----

First, start Redis on localhost, at a default port. Then:

```
npm test
```

Code coverage 
-----

Start Redis, then:

```
npm run-script cov
```

Coverage report will be in `coverage.html`.

License
----

MIT