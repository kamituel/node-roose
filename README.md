node-roose
==========

Extremely simple, promise based Redis object modeling tool.

Usage
-----

The following:

```javascript
var Vehicle = new Roose.Model('vehicle', {
	// properties starting with '$' will be keys in the Redis store.
	'$manufacturer': 'string',
	'$model': 'string',
	'date_of_production': 'number',
	'colors': ['string | HexColor'],
	'wheels': ['number | Int']
});

var tesla = Vehicle.create({
	'manufacturer': 'Tesla',
	'model': 'Model S',
	'date_of_production': new Date().getTime(),
	'colors': ['#ff0000', '#00ff00', '#0000ff'],
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
"sadd" "vehicle:Tesla__Model S:colors" "#ff0000" "#00ff00" "#0000ff"
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

which translates into following Redis commands:

```
"MULTI"
"get" "vehicle:Tesla__Model S:manufacturer"
"get" "vehicle:Tesla__Model S:model"
"get" "vehicle:Tesla__Model S:date_of_production"
"smembers" "vehicle:Tesla__Model S:colors"
"smembers" "vehicle:Tesla__Model S:wheels"
"EXEC"
```

Validation
----------

Since Redis operates on strings only, so does Roose. But, for your convienience, we've provided
so-called "data types". Data type is a set of validation rules defined for each field in a model. 
When you create an new instance of a model, each field has to pass those validation rules.

**Validator**
Roose uses Validator module (https://github.com/chriso/node-validator) for data validation. 
Validator exposes methods like `isHexColor()` or `isUppercase()`. Strip the `is` part and the rest
forms the name of your rule. For methods without `is` part, like `notEmpty()`, use them as they are.

You can specify your field to pass multiple such rules by "piping" them (use `|` for this). For instance:
```
'address': 'Url | Lowercase'
```
means that `address` should be an lower-case URL.

**Primitive types**
In addition to rules inherited from Validator, Roose defines primitives: `string`, `number` and `boolean`.
Those keys will be coerced when reading from Redis.

**Regular expressions**
Beside primitive types and Validator rules, you can specify format by regular expression - in a string format.

**Examples**
```javascript
var Student = new Roose.Model({
	'$name': 'string | /^\S+ .+$/',
	'age': 'number | Int',
	'sex': '/^male|female$/',
	'grades': ['Int']
});
```
Correct values for:
 - `name` - any string matching given regex.
 - `age` - any integer number, i.e. `5`, but not `"5"` (it's a string)
 - `sex` - either `male` or `female`.
 - `grades` - array of numbers, i.e. `[5, "5"]` - string values are allowed, because `number` rules is not used.

```javascript
var Client = new Roose.Model('client', {
	'$id': 'number | Int',
	'color': 'HexColor | Uppercase'
});
```

Correct values for:
 - `ip` - `5` (number), but not `"5"` (string) and not `5.1`.
 - `color` - `#FF00CC`, but not `#ff00cc` (lowercase).


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
