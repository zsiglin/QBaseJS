#QuickBase JavaScript Library for Node

###Installation
npm install qbase

###Usage
Populate the config object as seen below and pass it into the Base constructor. The "tables" object should be filled with any tables in your application you would like to interact with. See further examples in "examples.js".

```
var Base = require("qbase");

var config = {
  token: "",
  realm: "",
  username: "",
  password: "",
  databaseId: "",
  tables: {
    teachers: {
      dbid: "",
      rid: 3,
    }
  }
};

var db = new Base(config, function(){
  // Subsequent calls must be made within this callback
});
```
