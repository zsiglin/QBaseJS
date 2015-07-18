#QuickBase JavaScript Library for Node

###Installation
```
npm install qbase
```

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
      rid: 3
    }
  }
};

var db = new Base(config, function(){
  // subsequent calls must be made within this callback
  db.customers.all({ clist: ["rid"] }, function(response){
    // response == query results
  });
});
```
