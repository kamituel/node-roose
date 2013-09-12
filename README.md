node-roose
==========

Extremely simple, promise based Redis object modeling tool.

Usage
-----

The following:

```javascript
var Vehicle = new Roose.Model('vehicle', {
	// properties starting with '$' will be keys in the Redis store.
	'$manufacturer': String,
	'$model': String,
	'date_of_production': Number,       
	'wheels': [Number]
});

var tesla = Vehicle.create({
	'manufacturer': 'Tesla',
	'model': 'Model S',
	'date_of_production': new Date().getTime(),
	'wheels': [1, 2, 3, 4]
});	

tesla.save().done();

```

Translates into following Redis commands:

```
"MULTI"
"set" "vehicle:Tesla__Model S:manufacturer" "Tesla"
"set" "vehicle:Tesla__Model S:model" "Model S"
"set" "vehicle:Tesla__Model S:date_of_production" "1378994037125"
"sadd" "vehicle:Tesla__Model S:wheels" "1" "2" "3" "4"
"EXEC"
```

Later, you can retrieve this object:

```javascript
var query = Vehicle.get({
 'manufacturer': 'Tesla',
 'model': 'Model S'
})

query.then(function (tesla) {
  if (tesla) {
    console.log('Found the car!', tesla);
  } else {
    console.log('No such car');
  }
}).fail(function (err) {
  console.log('Error: ', err);
}).done();
```

whis translates into following Redis commands:

```
"MULTI"
"get" "vehicle:Tesla__Model S:manufacturer"
"get" "vehicle:Tesla__Model S:model"
"get" "vehicle:Tesla__Model S:date_of_production"
"smembers" "vehicle:Tesla__Model S:wheels"
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
