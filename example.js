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
      recordOwner: 5
    }
  }
};

var db = new Base(config, function(){
  var ticket = db.getOneTimeTicket(function(ticket){
    console.log("TICKET: " + ticket);
  });

  db.findDbByName("BaseJS Testing", function(response){
    console.log("FindDBByName: " + response);
  });
  
  db.getDbInfo(function(response){
    console.log("GET DB INFO: " + response);
  });
  
  db.grantedDbs({}, function(response){
    console.log(response)
    console.log("GRANTED DBS: " + response);
  });
  
  db.getAppDtmInfo(function(response){
    console.log("GET APP DTM INFO: " + response);
    console.log(response)
  });
  
  db.setDBVar("test", "hello world", function(variable){
    console.log("SET VAR: " + variable);
  });
  
  db.getDBVar("test", function(variable){
    console.log("GET VAR: " + variable);
  });
  
  db.uploadPage(null, "test.txt", "asdfadsf", function(pageId){
    console.log("UPLOAD PAGE: " + pageId);

    db.getDbPage(pageId, function(htmlPage){
    console.log("HTML: " + htmlPage);

      db.deletePage(pageId, function(success){
        console.log("DELETE PAGE: " + success);
      });
    }); 
  });
  
  db.getUserInfo("zsiglin@advantagequickbase.com", function(response){
    console.log("USER INFO: " + response["id"]);
  });
  
  db.getUserRoles(function(response){
    console.log("USER ROLES: " + response);
  });
  
  db.changeUserRole("58755660.cwj9", "12", "11", function(response){
    console.log("CHANGE USER ROLE: " + response);
  });

  var newRecordHash = { firstName: "Mike&Ike", lastName: "Johnson" }
  db.teachers.addRecord(newRecordHash, function(rid){
    console.log("ADD RECORD: " + rid);
  });
  
  db.teachers.getNumRecords(function(numberOfRecords){
    console.log("NUMBER OF RECORDS: " + numberOfRecords);
  });
  
  var editRecordHash = { firstName: "Stephan", lastName: "Smith" }
  db.teachers.editRecord("3924", editRecordHash, function(response){
    console.log("EDIT RECORD: " + response);
  });
  
  db.teachers.changeRecordOwner("3924", "zsiglin@advantagequickbase.com", function(response){
    console.log("CHANGE RECORD OWNER: " + response);
  });
  
  db.teachers.copyMasterDetail({destrid: "0", sourcerid: "3924", copyfid: "8"}, function(response){
    console.log("COPY RECORDS: " + response);
  });
  
  db.teachers.getRecordInfo("3924", function(response){
    console.log("GET RECORD INFO: " + response)
  });

  db.teachers.find("3924", function(response){
    console.log("FIND: " + response);
  });
  
  var qid = "1"
  db.teachers.doQuery(qid, { clist: ["rid"] }, function(response){
    console.log("QUERY 2: " + response);
  });
  
  db.teachers.all({ clist: ["a"] }, function(response){
    console.log("QUERY ALL: ", response);
  });
  
  db.teachers.getRids({ rid: "3924" }, function(response){
    console.log("FIND RIDS: " + response);
  });

  db.teachers.first({ rid: { XEX: "" } }, { clist: "rid"}, function(response){
    console.log("FIRST: " + response);
  });
  
  db.teachers.last({ rid: { XEX: "" } }, { clist: "rid"}, function(response){
    console.log("LAST: " + response);
  });
  
  var query = { rid: { XEX: "" } }
  db.teachers.doQueryCount(query, function(response){
    console.log("DO QUERY COUNT: " + response);
  });
  
  var response = db.teachers.deleteRecord("3924", function(response){
    console.log("DELETE: " + response);
  });
  
  var csvArray = [
    { firstName: "Mike\"s", lastName: "John>s&o<n" },
    { firstName: "Step,hani\"e", lastName: "Wallace" },
    { firstName: "Jackson", lastName: "Williams" },
    { firstName: "Martin", lastName: "Douglas" }
  ]

  db.teachers.importFromCSV(csvArray, function(response){
    console.log("IMPORT: " + response);
  });
  
  var query = { rid: { XEX: "" } };
  var response = db.teachers.purgeRecords(query, function(response){
    console.log("PURGE: " + response);
  });
  
  var response = db.teachers.getTableFields(function(response){
    console.log("TABLE FIELDS: " + response);
  });
});