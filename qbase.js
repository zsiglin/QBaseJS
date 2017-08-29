var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var XML = require('pixl-xml');

function BaseConnect(config, baseInstance){
  this.config = config;
  this.inverseTables = BaseHelpers.inverseTables(config.tables);

  this.apptoken = config.token;
  this.databaseId = config.databaseId;
  this.realm = config.realm;
  this.username = config.username;
  this.password = config.password;
  this.ticket = null;

  this.post = function(data, callback, handler){
    var type = data.type || "API";
    var action = type + "_" + data.action;
    var dbid = "";
    var tableName = data.dbid;

    if(!data.dbid){
      dbid = this.databaseId;
    }else{
      if(this.config && data.dbid != "main"){
        if(data.dbid == this.databaseId){
          dbid = this.databaseId;
        }else{
          dbid = this.config.tables[data.dbid].dbid;
        };
      }else{
        dbid = data.dbid;
      };      
    };

    return this.xmlPost(dbid, tableName, action, data, callback, handler);
  },

  this.xmlPost = function(dbid, tableName, action, data, callback, handler){
    var url = "https://" + this.realm + ".quickbase.com/db/" + dbid + "?act=" + action;
    var _this = this;

    data.ticket = this.ticket;
    data = this.buildPostData(tableName, data);

    var req = new XMLHttpRequest();
    req.open("POST", url, true);
    req.onreadystatechange = function() {
      if(req.readyState == 4 && req.status == 200) {
        var xml = XML.parse(req.responseText);
        xml = handler(xml);

        if(!_this.ticket && action == "API_Authenticate"){
          _this.ticket = xml;
        };

        callback(xml);
      }
    }
    req.setRequestHeader("Content-Type", "text/xml");
    req.send(data);
  },

  this.generateQuickbaseQuery = function(query){
    var validQuery = [];

    var handleEx = function(key, value){
      return "{'"+key+"'.EX.'"+value+"'}";
    };

    var handleOtherOperators = function(key, value){
      var operator = Object.keys(value)[0];
      var compareValue = value[operator];
      var queryPart = "";

      if(operator == "in"){
        var queryParts = [];

        compareValue.forEach(function(v){
          queryParts.push("{'"+key+"'.EX.'"+v+"'}");
        });

        queryPart = "(" + queryParts.join("OR") + ")";
      }else{
        queryPart = "{'"+key+"'."+operator+".'"+compareValue+"'}";
      };

      return queryPart;
    };

    var handleOr = function(key, value){
      var queryPart = [];

      value.forEach(function(query){
        var key = Object.keys(query)[0];
        var value = query[key];

        if(typeof value == "object"){
          var query = handleOtherOperators(key, value);
          queryPart.push(query);
        }else{
          var query = handleEx(key, value);
          queryPart.push(query);
        };
      });

      return "(" + queryPart.join("OR") + ")";
    };

    for(key in query){
      var value = query[key];
      var queryPart = "";

      if(key == "or"){
        queryPart = handleOr(key, value);
      }else{
        if(typeof value == "object"){
          queryPart = handleOtherOperators(key, value);
        }else{
          queryPart = handleEx(key, query[key]);
        };
      };

      validQuery.push(queryPart);
    };

    validQuery = validQuery.join("AND");
    return validQuery;
  };

  this.replaceFieldNames = function(query, dbid){
    var config = this.config;

    query = query.split(/(AND|OR)/).map(function(queryPart){
      if(queryPart != "AND" && queryPart != "OR"){
        var field = queryPart.match(/\{'*(.*)'\..*'/)[1];

        if(isNaN(field)){
          var fid = config.tables[dbid][field];  
          queryPart = queryPart.replace(field, fid);
        };
      };

      return queryPart;
    });

    return query.join("");
  };

  this.replaceOptionFieldNames = function(value, dbid){
    var config = this.config;

    value = value.split(".");
    value = value.map(function(fieldName){
      if(isNaN(fieldName)){
        var fid = config.tables[dbid][fieldName];
        return fid;
      }else{
        return fieldName;
      }
    });

    return value.join(".");
  };

  this.handleXMLCharacters = function(string){
    if (typeof string == "string") {
      string = string
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    };

    return string;
  };

  this.buildPostData = function(dbid, data){
    var postData = ["<qdbapi>"];

    if(this.apptoken){
      postData.push(this.createParameter("apptoken", this.apptoken));
    };

    if(this.ticket){
      postData.push(this.createParameter("ticket", this.ticket));
    };

    for(key in data.params){
      var value = data.params[key];

      if(key == "clist" || key == "slist" || key == "options"){
        if(typeof value == "object"){
          value = value.join(".");
        };

        if(this.config && (key == "clist" || key == "slist")){
          if(value){
            value = this.replaceOptionFieldNames(value, dbid);  
          };
        };
      }else if(key == "query"){
        value = this.generateQuickbaseQuery(value);

        if(this.config){
          value = this.replaceFieldNames(value, dbid);
        };

        key = "query";
      };

      if(value){
        postData.push(this.createParameter(key, value));
      };
    };

    for(field in data.fieldParams){
      if(this.config){
        var fid = this.config.tables[dbid][field];
      }else{
        var fid = field;
      };
      
      var fieldValue = this.handleXMLCharacters(data.fieldParams[field]);      
      postData.push(this.createFieldParameter(fid, fieldValue));
    };

    for(key in data.fidParams){
      postData.push(this.createFidParameter(key, data.fidParams[key]));
    };

    if(data.csvData){
      postData.push(this.createCSVParameter(data.csvData));
    };

    postData.push("</qdbapi>");
    postData = postData.join("");

    return postData;
  };

  this.getNode = function(response, tag){
    var parsed;

    if(tag){
        tag = tag.split(">");

        for(var i=0;i<tag.length;i++){
          var current_tag = tag[i];
          if(typeof response[current_tag] == "string"){
            parsed = response[current_tag];
            break;
          } else {
            response = response[current_tag]
          }
        }
    }

    return parsed;
  };

  this.getRecords = function(dbid, response){
    var records = response.table.records.record || [];
    var recordsArray = [];

    if(!(records instanceof Array)){
      records = [records];
    }

    for(var i=0; i < records.length; i++){
      var record = records[i];
      var fields = record.f;
      record = {}

      if(!(fields instanceof Array)){
        fields = [fields];
      }

      for(var j=0; j < fields.length; j++){
        var field = fields[j];
        var id = parseInt(field.id);

        if(field.url){
          var url = field.url;
          var sections = url.split("/");
          var filename = sections[sections.length - 1];

          var value = {"filename": filename, "url": url};
        } else {
          var value = field._Data || "";
        };

        if(this.config){
          var tableConfig = this.inverseTables[dbid];
          if(tableConfig[id]){
            id = tableConfig[id.toString()];
            record[id] = value;   
          };
        } else {
          record[id] = value;
        };
      };

      recordsArray.push(record);
    };

    return recordsArray;
  };

  this.getRids = function(response){
    var records = response.table.records.record || [];
    var ridsArray = [];

    for(var i=0; i < records.length; i++){
      var record = records[i];
      ridsArray.push(record.f._Data);
    };

    return ridsArray;
  };

  this.getNewRids = function(response){
    var ridsArray = [];
    var rids = response.rids;

    if(rids){
      rids = rids.rid;

      for(var i=0; i < rids.length; i++){
        var rid = parseInt(rids[i]["_Data"]);
        ridsArray.push(rid);
      };
    }

    return ridsArray;
  };

  this.getFields = function(schema){
    var fields = schema.table.fields.field;
    var fieldsObj = {};

    for(var i=0; i < fields.length; i++){
      var field = fields[i];
      var fieldHash = {
        "label": field.label,
        "nowrap": field.nowrap,
        "bold": field.bold,
        "required": field.required,
        "appears_by_default": field.appears_by_default,
        "find_enabled": field.find_enabled,
        "allow_new_choices": field.allow_new_choices,
        "sort_as_given": field.sort_as_given,
        "carrychoices": field.carrychoices,
        "foreignkey": field.foreignkey,
        "unique": field.unique,
        "doesdatacopy": field.doesdatacopy,
        "fieldhelp": field.fieldhelp,
        "display_user": field.display_user,
        "default_kind": field.default_kind
      }

      fieldsObj[field.id] = fieldHash;
    };

    return fieldsObj;
  };

  this.getReports = function(schema){
    var reports = schema.table.queries.query;
    var reportsObj = {};

    for(var i=0; i < reports.length; i++){
      var report = reports[i];
      var reportHash = {
        "name": report.qyname,
        "type": report.qytype,
        "criteria": report.qycrit,
        "clist": report.qyclst,
        "slist": report.qyslst,
        "options": report.qyopts
      }

      reportsObj[report.id] = reportHash;
    };

    return reportsObj;
  };

  this.formatUserRoles = function(schema){
    var users = schema.users.user;
    var allUsers = [];

    for(var i=0; i < users.length; i++){
      var user = users[i];
      var roles = user.roles.role;

      if(!(roles instanceof Array)){
        roles = [roles];
      }

      var userRoles = [];
      for(var j=0; j < roles.length; j++){
        var role = roles[j];

        if(role.id != undefined){
          var roleHash = {
            "id": role.id,
            "name": role.name,
            "accessId": role.access.id,
            "access": role.access._Data
          }
        }
        
        userRoles.push(roleHash);
      };

      var userHash = {
        "id": user.id,
        "firstName": user.firstName,
        "lastName": user.lastName,
        "lastAccess": user.lastAccess,
        "lastAccessAppLocal": user.lastAccessAppLocal,
        "roles": userRoles
      };

      allUsers.push(userHash);
    };

    return allUsers;
  };

  this.createParameter = function(key, value){
    return "<" + key + ">" + value + "</" + key + ">";
  };

  this.createFieldParameter = function(fid, value){
    var param = "<field fid='" + fid + "'";

    if(value){
      if(value.filename){
        param += " filename='" + value.filename + "'>";
        if (value.ignoreEncoding == true) {
          param += value.body;
        } else {
          param += this.base64Encode(value.body);
        };
      }else{
        param += ">"
        param += value;
      };
    }else{
      param += ">";
    };

    param += "</field>";
    return param;
  };

  this.createFidParameter = function(fid, value){
    return "<_fid_" + fid + ">" + value + "</_fid_" + fid + ">";
  };

  this.createCSVParameter = function(data){
    return "<records_csv><![CDATA[" + data + "]]></records_csv>";
  };

  this.base64Encode = function(input){
    var output = "";
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    var string = input.replace(/\r\n/g,"\n");
    var utfText = "";

    for(var n=0; n < string.length; n++){
      var c = string.charCodeAt(n);

      if (c < 128) {
        utfText += String.fromCharCode(c);
      }
      else if((c > 127) && (c < 2048)) {
        utfText += String.fromCharCode((c >> 6) | 192);
        utfText += String.fromCharCode((c & 63) | 128);
      }
      else {
        utfText += String.fromCharCode((c >> 12) | 224);
        utfText += String.fromCharCode(((c >> 6) & 63) | 128);
        utfText += String.fromCharCode((c & 63) | 128);
      }
    }

    input = utfText;

    while(i < input.length){
      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);

      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;

      if(isNaN(chr2)){
        enc3 = enc4 = 64;
      }else if(isNaN(chr3)){
        enc4 = 64;
      };

      output = output +
      keyStr.charAt(enc1) + keyStr.charAt(enc2) +
      keyStr.charAt(enc3) + keyStr.charAt(enc4);
    };

    return output;
  };

  this.parseResponse = function(xml){
    var errorCode = this.getNode(xml, "errcode");
    
    if(errorCode != "0"){
      console.log(
        "*****ERROR*****: (" + this.getNode(xml, "action") + ")" + "(CODE: " + errorCode + ")",
        "MESSAGE: " + this.getNode(xml, "errtext") + " - " + this.getNode(xml, "errdetail")
      );
    };

    return xml;
  };
}

module.exports = function Base(config, callback){
  var BaseConnectInstance = new BaseConnect(config, this);
  this.databaseId = config.databaseId;

  this.Table = function(key, config){
    this[key] = config;
    this.tableName = key;
    this.dbid = config.dbid;

    this.doQuery = function(query, params, callback, handle){
      var tableName = this.tableName;

      var _handle = function(response){
        return BaseConnectInstance.getRecords(tableName, response);
      };

      var queryParams = {"fmt": "structured"}
      if(query){
        var isQid = !isNaN(query);

        if(isQid){
          queryParams.qid = query;
        }else{
          queryParams.query = query;
        };
      }else{
        queryParams.query = "{'3'.XEX.''}"
      };

      if(params){
        var clist = params.clist;  
      }else{
        var params = {};
      };

      if(BaseConnectInstance.config && !clist){
        var table = BaseConnectInstance.config.tables[tableName];
        
        var clist = [];
        for(key in table){
          var value = table[key];

          if(!isNaN(value)){
            clist.push(key);
          };
        };

        params.clist = clist.join(".");
      };

      queryParams.clist = params.clist;
      queryParams.slist = params.slist
      queryParams.options = params.options

      var data = {
        dbid: tableName,
        action: "DoQuery",
        params: queryParams
      };

      if(handle){
        _handle = handle;
      };

      return BaseConnectInstance.post(data, callback, _handle);
    };

    this.find = function(rid, callback){
      var tableName = this.tableName;

      var handle = function(response){
        var records = BaseConnectInstance.getRecords(tableName, response, "records");
        if(records.length > 0){
          if(records.length > 1){
            return records;
          }else{
            return records[0];
          };
        }else{
          return {};
        };
      };
      
      if(Object.prototype.toString.call(rid) == "[object Array]"){
        var query = { "3": { in: rid }}
      }else{
        var query = { "3": rid };
      };
      
      return this.doQuery(query, null, callback, handle);
    };

    this.first = function(query, params, callback){
      var tableName = this.tableName;

      var handle = function(response){
        var records = BaseConnectInstance.getRecords(tableName, response, "records");
        if(records.length > 0){
          return records[0];
        }else{
          return {};
        };
      };

      return this.doQuery(query, params, callback, handle);
    };

    this.last = function(query, params, callback){
      var tableName = this.tableName;

      var handle = function(response){
        var records = BaseConnectInstance.getRecords(tableName, response, "records");
        if(records.length > 0){
          return records[records.length - 1];
        }else{
          return {};
        };
      };

      return this.doQuery(query, params, callback, handle);
    };

    this.all = function(params, callback){
      var tableName = this.tableName;

      var handle = function(response){
        var records = BaseConnectInstance.getRecords(tableName, response, "records");
        if(records.length > 0){
          return records;
        }else{
          return {};
        };
      };

      return this.doQuery({ "3": { XEX: "" } }, params, callback, handle);
    };

    this.getRids = function(query, callback){
      var handle = function(response){
        return BaseConnectInstance.getRids(response);
      };

      params = {
        clist: "3"
      };

      if(!query){
        query = { "3": { XEX: "" } }  
      };

      return this.doQuery(query, params, callback, handle);
    };

    this.doQueryCount = function(query, callback){
      var handle = function(response){
        return BaseConnectInstance.getNode(response, "numMatches");
      };

      var data = {
        dbid: this.tableName,
        action: "DoQueryCount",
        params: {"query": query}
      };

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.addRecord = function(fieldParams, callback){
      var handle = function(response){
        return parseInt(BaseConnectInstance.getNode(response, "rid"));
      };

      var data = {
        dbid: this.tableName,
        action: "AddRecord",
        fieldParams: fieldParams
      };

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.editRecord = function(rid, fieldParams, callback){
      var handle = function(response){
        var rid = BaseConnectInstance.getNode(response, "rid");
        return rid ? true : false;
      };

      var data = {
        dbid: this.tableName,
        action: "EditRecord",
        fieldParams: fieldParams,
        params: {"rid": rid}
      }

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.changeRecordOwner = function(rid, owner, callback){
      var handle = function(response){
        return true;
      };

      var data = {
        dbid: this.tableName,
        action: "ChangeRecordOwner",
        params: {"rid": rid, "newowner": owner}
      };

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.copyMasterDetail = function(params, callback){
      var handle = function(response){
        return BaseConnectInstance.getNode(response, "numCreated");
      };

      var data = {
        dbid: this.tableName,
        action: "CopyMasterDetail",
        params: params
      };

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.getRecordInfo = function(rid, callback){
      var handle = function(response){

        var allFields = {};
        var fields = response.field || [];

        for(var i=0; i < fields.length; i++){
          var field = fields[i];
          var fieldHash = {
            "name": BaseConnectInstance.getNode(field, "name"),
            "type": BaseConnectInstance.getNode(field, "type"),
            "value": BaseConnectInstance.getNode(field, "value")
          };

          allFields[field.fid] = fieldHash;
        };

        var info = {
          "rid": BaseConnectInstance.getNode(response, "rid"),
          "num_fields": BaseConnectInstance.getNode(response, "num_fields"),
          "update_id": BaseConnectInstance.getNode(response, "update_id"),
          "fields": allFields
        };

        return info;
      };

      var data = {
        dbid: this.tableName,
        action: "GetRecordInfo",
        params: { "rid": rid }
      };

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.deleteRecord = function(rid, callback){
      var handle = function(response){
        var rid = BaseConnectInstance.getNode(response, "rid");
        return rid ? true : false;
      };

      var data = {
        dbid: this.tableName,
        action: "DeleteRecord",
        params: {"rid": rid}
      };

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.purgeRecords = function(query, callback){
      var handle = function(response){
        var numberOfRecordDeleted = BaseConnectInstance.getNode(response, "num_records_deleted");
        return parseInt(numberOfRecordDeleted);
      };

      var data = {
        dbid: this.tableName,
        action: "PurgeRecords",
        params: {"query": query}
      };

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.importFromCSV = function(csvArray, callback){
      var handle = function(response){
        return BaseConnectInstance.getNewRids(response);
      };

      var csv = "";
      var clist = [];

      for(key in csvArray[0]){
        if(BaseConnectInstance.config){
          tableConfig = BaseConnectInstance.config.tables[this.tableName];
          key = tableConfig[key];
        };
        
        clist.push(key);  
      };

      clist = clist.join(".");

      for(var i=0; i < csvArray.length; i++){
        var row = csvArray[i];
        var rowValues = [];

        for(key in row){
          value = row[key];
          value = value.toString().replace(/"/g, '""');
          rowValues.push('"' + value + '"');
        };

        rowValues.join(",")
        rowValues += "\n"

        csv += (rowValues);
      };

      var data = {
        dbid: this.tableName,
        action: "ImportFromCSV",
        params: {"clist": clist},
        csvData: csv
      }

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.getTableFields = function(callback){
      var handle = function(response){
        return BaseConnectInstance.getFields(response);
      };

      var data = {
        dbid: this.tableName,
        action: "GetSchema"
      };

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.getNumRecords = function(callback){
      var handle = function(response){
        return parseInt(BaseConnectInstance.getNode(response, "num_records"));
      };

      var data = {
        dbid: this.tableName,
        action: "GetNumRecords"
      };

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.setFieldProperties = function(fid, params, callback){
      var handle = function(response){
        var error = BaseConnectInstance.getNode(response, "errcode");
        return error == 0 ? true : false;
      };

      params["fid"] = fid;

      var data = {
        dbid: this.tableName,
        action: "SetFieldProperties",
        params: params
      };

      return BaseConnectInstance.post(data, callback, handle);
    };

    this.getTableReports = function(callback){
      var handle = function(response){
        return BaseConnectInstance.getReports(response);
      };

      var data = {
        dbid: this.tableName,
        action: "GetSchema"
      };

      return BaseConnectInstance.post(data, callback, handle);
    };
  };

  this.setTables = function(tables){
    for(key in tables){
      this[key] = new this.Table(key, tables[key]);
    };
  };

  this.setTables(config.tables);

  this.getOneTimeTicket = function(callback){
    var handle = function(response){
      return BaseConnectInstance.getNode(response, "ticket");
    };

    var data = {
      dbid: "main",
      action: "GetOneTimeTicket"
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.authenticate = function(username, password, hours, callback){
    var handle = function(response){
      return BaseConnectInstance.getNode(response, "ticket");
    };

    var data = {
      dbid: "main",
      action: "Authenticate",
      params: { "username": username, "password": password, "hours": hours }
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.getDBVar = function(name, callback){
    var handle = function(response){
      return BaseConnectInstance.getNode(response, "value");
    };

    var data = {
      dbid: this.databaseId,
      action: "GetDBvar",
      params: {"varname": name}
    };

    return BaseConnectInstance.post(data, callback, handle)
  };

  this.setDBVar = function(name, value, callback){
    var handle = function(response){
      return true;
    };

    var data = {
      dbid: this.databaseId,
      action: "SetDBvar",
      params: {"varname": name, "value": value}
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.uploadPage = function(id, name, body, callback){
    var handle = function(response){
      return BaseConnectInstance.getNode(response, "pageID");
    };

    var params = {
      "pagetype": "1", 
      "pagebody": body
    };

    if(id){
      params["pageid"] = id;
    }else if(name){
      params["pagename"] = name;
    };

    var data = {
      dbid: this.databaseId,
      action: "AddReplaceDBPage",
      params: params
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.deletePage = function(pageId, callback){
    var handle = function(response){
      var error = BaseConnectInstance.getNode(response, "errcode");
      return error == "0" ? true : false;
    };

    var data = {
      dbid: this.databaseId,
      action: "PageDelete",
      type: "QBI",
      params: {"pageid": pageId}
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.getDbPage = function(pageId, callback){
    var handle = function(response){
      return BaseConnectInstance.getNode(response, "pagebody");
    };

    var data = {
      dbid: this.databaseId,
      action: "GetDBPage",
      type: "API",
      params: { "pageID": pageId }
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.cloneDatabase = function(params, callback){
    var handle = function(response){
      return BaseConnectInstance.getNode(response, "newdbid");
    };

    var data = {
      dbid: this.databaseId,
      action: "CloneDatabase",
      type: "API",
      params: params
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.createDatabase = function(name, description, createAppToken, callback){
    var handle = function(response){
      return BaseConnectInstance.getNode(response, "dbid");
    };

    var data = {
      action: "CreateDatabase",
      type: "API",
      params: { "dbname": name, "dbdesc": description, "createapptoken": createAppToken || false }
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.deleteDatabase = function(callback){
    var handle = function(response){
      var error = BaseConnectInstance.getNode(response, "errcode");
      return error == "0" ? true : false;
    };

    var data = {
      dbid: this.databaseId,
      action: "DeleteDatabase",
      type: "API"
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.renameApp = function(name, callback){
    var handle = function(response){
      var error = BaseConnectInstance.getNode(response, "errcode");
      return error == "0" ? true : false;
    };

    var data = {
      dbid: this.databaseId,
      action: "RenameApp",
      type: "API", 
      params: { "newappname": name }
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.findDbByName = function(name, callback){
    var handle = function(response){
      return BaseConnectInstance.getNode(response, "dbid");
    };

    var data = {
      action: "FindDBByName",
      dbid: "main",
      type: "API", 
      params: { "dbname": name }
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.getAppDtmInfo = function(callback){
    var handle = function(response){
      var allTables = {};
      var tables = response.tables.table;
      for(var i=0; i < tables.length; i++){
        var table = tables[i];
        var tableHash = {
          "lastModifiedTime": table.lastModifiedTime,
          "lastRecModTime": table.lastRecModTime
        };

        allTables[table.id] = tableHash;
      };

      var info = {
        "requestTime": BaseConnectInstance.getNode(response, "RequestTime"),
        "requestNextAllowedTime": BaseConnectInstance.getNode(response, "RequestNextAllowedTime"),
        "lastModifiedTime": BaseConnectInstance.getNode(response, "lastModifiedTime"),
        "lastRecModTime": BaseConnectInstance.getNode(response, "lastRecModTime"),
        "tables": allTables
      };

      return info;
    };

    var data = {
      action: "GetAppDTMInfo",
      dbid: "main",
      type: "API",
      params: { "dbid": this.databaseId }
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.getDbInfo = function(callback){
    var handle = function(response){
      var info = {
        "dbname": BaseConnectInstance.getNode(response, "dbname"),
        "lastRecModTime": BaseConnectInstance.getNode(response, "lastRecModTime"),
        "createdTime": BaseConnectInstance.getNode(response, "createdTime"),
        "numRecords": BaseConnectInstance.getNode(response, "numRecords"),
        "mgrID": BaseConnectInstance.getNode(response, "mgrID"),
        "mgrName": BaseConnectInstance.getNode(response, "mgrName"),
        "version": BaseConnectInstance.getNode(response, "version"),
        "time_zone": BaseConnectInstance.getNode(response, "time_zone")
      };

      return info;
    };

    var data = {
      dbid: this.databaseId,
      action: "GetDBInfo",
      type: "API"
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.grantedDbs = function(params, callback){
    var handle = function(response){

      var allDatabases = [];
      var databases = response.databases.dbinfo;

      for(var i=0; i < databases.length; i++){
        var database = databases[i];
        var databaseHash = {
          "dbname": BaseConnectInstance.getNode(database, "dbname"),
          "dbid": BaseConnectInstance.getNode(database, "dbid")
        };

        allDatabases.push(databaseHash);
      };

      return allDatabases;
    };

    var data = {
      action: "GrantedDBs",
      dbid: "main",
      type: "API",
      params: params
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.getUserInfo = function(email, callback, handler){
    var handle = function(response){
      var user = response.user;

      user = {
        "id": user.id,
        "firstName": user.firstName,
        "lastName": user.lastName,
        "login": user.login,
        "email": user.email,
        "screenName": user.screenName,
        "isVerified": user.isVerified,
        "externalAuth": user.externalAuth
      };

      return user;
    };

    if(!email){
      email = "";
    };

    var data = {
      dbid: "main",
      action: "GetUserInfo",
      params: {"email": email}
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.getUserRoles = function(callback){
    var handle = function(response){
      return BaseConnectInstance.formatUserRoles(response);
    };

    var data = {
      dbid: this.databaseId,
      action: "UserRoles"
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.changeUserRole = function(userId, roleId, newRoleId, callback){
    var handle = function(response){
      return true;
    };

    var data = {
      dbid: this.databaseId,
      action: "ChangeUserRole",
      params: {
        userId: userId,
        roleId: roleId
      }
    };

    if(newRoleId){
      data["params"]["newRoleId"] = newRoleId;
    };

    return BaseConnectInstance.post(data, callback, handle);
  };

  this.authenticate(config.username, config.password, "24", callback);
}

var BaseHelpers = {
  options: {
    timeZone: 'utc',
    format: 'hours'
  },

  inverseTables: function(config){
    var inverseTables = {};

    for(var table in config){
      var newObject = {};

      for(var field in config[table]){
        newObject[config[table][field].toString()] = field;
      };

      inverseTables[table] = newObject;
    };

    return inverseTables;
  },

  formatDateElement: function(element){
    element = element.toString();
    if(element.length == 1){
      element = "0" + element;
    };

    return element;
  },

  dateToString: function(milliseconds){
    if(milliseconds) {
      var date = new Date( parseInt(milliseconds) );
      var month = this.formatDateElement((date.getUTCMonth() + 1));
      var day = this.formatDateElement(date.getUTCDate());

      date = [month, day, date.getUTCFullYear()].join("-");

      return date;
    } else {
      return ' ';
    }
  },

  dateTimeToString: function(milliseconds, timeZone) {
    var today = new Date();
    var timeZone = timeZone ? timeZone.toLowerCase().trim() : this.options.timeZone.toLowerCase();

    Date.prototype.stdTimezoneOffset = function() {
      var jan = new Date(this.getFullYear(), 0, 1);
      var jul = new Date(this.getFullYear(), 6, 1);
      return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    }

    Date.prototype.dst = function() {
      return this.getTimezoneOffset() < this.stdTimezoneOffset();
    }

    var zoneOffsets = {
      "utc": 0,
      "eastern": today.dst() ? -4 : -5,
      "central": today.dst() ? -5 : -6,
      "mountain": today.dst() ? -6 : -7,
      "pacific": today.dst() ? -7 : -8
    };

    var offset = zoneOffsets[timeZone];

    if(milliseconds) {
      var date = new Date( parseInt(milliseconds) + (60 * 60 * 1000 * offset) );

      var year = this.formatDateElement((date.getUTCFullYear));
      var month = this.formatDateElement((date.getUTCMonth() + 1));
      var day = this.formatDateElement(date.getUTCDate());
      var hours = this.formatDateElement(date.getUTCHours());
      var minutes = this.formatDateElement(date.getUTCMinutes());
      var seconds = this.formatDateElement(date.getUTCSeconds());

      var dateTime = [month, day, date.getUTCFullYear()].join("-");
      var ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
      
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'

      dateTime += " "
      dateTime += [hours, minutes].join(":")
      dateTime += " " + ampm
      return dateTime;
    } else {
      return '';
    }
  },

  durationToString: function(milliseconds, format) {
    var ms = parseInt(milliseconds);
    var result;
    var format = format ? format.trim().toLowerCase() : this.options.format.toLowerCase();

    var formatType = {
      "days": function() {
        return ms / 86400000;
      },
      "hours": function() {
        return ms / 3600000;
      },
      "minutes": function() {
        return ms / 60000;
      },
      "seconds": function() {
        return ms / 1000;
      }
    };

    if(milliseconds) {
      if (formatType[format]) {
        result = formatType[format]();
      } else {
        result = formatType["hours"]();
        console.log("The format parameter passed to BaseHelpers.durationToString() was incorrect. Using the format for 'hours' instead.");
      }

      result = Math.round(result * 100) / 100;
      return result.toString();
    } else {
      return '';
    }
  },

  timeOfDayToString: function(milliseconds){
    var timeOfDay = "";

    timeOfDay = new Date()
    timeOfDay.setHours("");
    timeOfDay.setMinutes("");
    timeOfDay.setSeconds("");
    timeOfDay.setMilliseconds(milliseconds);

    var hours = timeOfDay.getHours().toString();
    var minutes = timeOfDay.getMinutes().toString();
    var ampm = hours > 12 ? "pm" : "am";

    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes.length > 1 ? minutes : "0" + minutes;

    timeOfDay = hours + ":" + minutes + " " + ampm

    return timeOfDay;
  }
};