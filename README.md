#QuickBase JavaScript Library for Node

###Installation
```shell
npm install qbase
```

###QBaseJS
QBaseJS is the Node version of the [BaseJS](https://github.com/KitHensel/BaseJS) client side library. With the exception of a few config properties they have the same API, so see their docs for further info.

###New in 2.0.0
QBaseJS now supports promises in addition to callbacks! All methods will return a promise, just don't pass in a callback and interact with the returned promise instead. If you prefer the callback syntax then nothing changes, simply pass a callback as the third argument.

###Usage
Populate the config object in the format seen below and pass it into the Base constructor. The "tables" object should be filled with any tables in your application you would like to interact with.

See further examples in "example.js".

```javascript
var Base = require("qbase");

var config = {
  // apptoken parameter is optional
  token: "",
  realm: "xyzcorp",
  username: "john@xyzcorp.com",
  password: "password",
  databaseId: "bj3xvxtzw",
  tables: {
    customers: {
      dbid: "bj3xvxt6t",
      rid: 3,
      name: 6,
      address: 7
    }
  }
};

var db = new Base(config);

// CALLBACK SYNTAX
db.customers.doQuery({rid: '123'}, {clist: ['rid', 'name']}, function(customers) {
  // do something with the 'customers' response
});


// PROMISE SYNTAX
db.customers.doQuery({rid: '123'}).then(function(customers) {
  // do something with the 'customers' response
});
```
