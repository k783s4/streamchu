//create AWS EC2 instances, manage changes to them, monitor wasted resources
let database = require("./database.js");
let express = require("express");
let readline = require("readline");
let axios = require("axios");
let rsa = require("node-rsa");
let path = require("path");
const fs = require("fs");
let helmet = require("helmet");
//TODO: remove all setup functions for deployment
//TODO: node-cache all functions thay may get accesses by processes simultaneously
let app = express();

//define app as using JSON and helmet
app.use(express.json());
app.use(helmet());

const key = new rsa();

setupKey();
setuprl();

function setupKey() {
  //find RSA private key
  let pathtoRSA = path.resolve("..", "..", "pkey.key");

  //read and create RSA key
  fs.readFile(pathtoRSA, function(err, data) {
    if (err) {
      throw err;
    }else{
    let keyinput = data;
    key.importKey(keyinput);
  }
  });
}

//connect to database
let con = database.connect();

function setuprl() {
  //set up for exit TODO: remove / rewrite completely to meet specifications
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.on("close", function() {
    console.log("stopping service");
    con.end();
    process.exit(0);
  });
  rl.on("line", function(input) {
    //if asks for all running servers
    if (input === "list servers") {
      database.query(`SELECT * FROM resources;`, con).then((data) => {
        console.log("running servers:");
        console.log(data);
      }).catch((err) => console.log(err));
    }
    //else if deleting of resource is requested
    else if (input.startsWith("del server")) {
      //get server ip
      let ip = input.split("server ")[1];
      //generate signature and timestamp
      let ts = Date.now();
      let sign = key.sign(Buffer.from(Date.now()));
      //make request to server
      axios.post(`http://${ip}:8003/allocDel`, {
          timestamp: ts,
          signature: sign
        })
        .then(res => {
          console.log(`statusCode: ${res.status}`)
          console.log(res)

          //if request was successful
          if (res.status === 200) {
            //TODO:close EC2 instance

            //remove server from resources list
          }
        })
        .catch(error => {
          console.error(error)
        });
    }
    //list all streams
    else if (input === "list streams") {
      database.query(`SELECT * FROM streaming_on ORDER BY streamer_dpname;`, con).then((data) => {
        console.log("running streams:");
        console.log(data);
      }).catch((err) => console.log(err));
    }
    //delete selected stream
    else if (input.startsWith("del stream")) {

    } else if (input.startsWith("init")) {
      //get server ip
      let ip = input.split("init ")[1];
      //generate signature and timestamp
      let ts = Date.now();
      let sign = key.sign(Buffer.from(Date.now().toString()));
      //make request to server
      axios.post(`http://${ip}:8003/init`, {
          timestamp: ts,
          signature: sign
        })
        .then(res => {
          console.log(`statusCode: ${res.status}`)
          console.log(res)

          //if request was successful
          if (res.status === 200) {
            console.log(res);
            //update available resources in database
            database.query(`UPDATE resources SET public_key = '${res.data.pkey}', free = '${res.data.availableResources}' WHERE IP = '${ip}';`, con).then(() => {
              console.log("updated");
            }).catch((err) => console.log(err));
          }
        })
        .catch(error => {
          console.error(error)
        });

    } else {
      console.log("available options:\r\nlist servers\r\nlist streams\r\ndel server\r\ndel stream\r\ninit");
    }
  });
}

//when stream is called, create new lobby
app.post("/stream", function(req, res, next) {
  let username = "";
  let sessid = "";
  //get credentials
  try {
    username = req.body.username;
    sessionID = req.body.sessid;

    //if any of the variables are undefined or empty
    if(typeof username == "undefined" || !username || typeof sessionID == "undefined" && !sessionID){
      console.log("Bad request");
      res.writeHead(400, {
        "content-type": "text/html"
      });
      res.end("Bad request");
      return;
    }
  } catch {
    //in case of error
    console.log("Bad request");
    res.writeHead(400, {
      "content-type": "text/html"
    });
    res.end("Bad request");
  }

  //check for clean input
  if (database.checkforcleaninput(username) && database.checkforcleaninput(sessionID)) {} else {
    res.writeHead(401, {
      "content-type": "text/html"
    });
    res.end("Bad Input");
    return;
  }

  //confirm credentials
  database.query(`SELECT * FROM stream_sessions WHERE streamer_session='${sessionID}';`, con).then((result) => {
    if (result.length === 1) {
      //if one result is found
      //get correct streamer_id
      database.query(`SELECT * FROM streamers WHERE username='${username}';`, con).then((result2) => {
        if (result2.length === 1) {
          //if usernames match
          if (result2[0].streamer_id === result[0].streamer_id) {
            //check if streamer has minutes remaining
            if (result2[0].minutes_remaining > 0) {
              //continue to next then with account data
              return [result2[0].max_viewers, result2[0].minutes_remaining, result2[0].display_name, sessionID];
            } else {
              //continue to next as no minutes remaining
              return 0;
            }
          }
        } else {
          //in case username is invalid
          res.writeHead(401, {
            "content-type": "text/html"
          });
          res.end("Invalid credentials");
          //continue to next then as false
          return false;
        }
      }).then((result) => {
        //check if streamer is already streaming
        if (Array.isArray(result)) {
          database.query(`SELECT * FROM streaming_on WHERE streamer_dpname = '${result[2]}';`, con).then((streamisFound) => {
            if (streamisFound.length === 0) {
              //all good
            } else {
              //do you wish to double stream:
              res.writeHead(401, {
                "content-type": "text/html"
              });
              res.end("You are already streaming");
              return;
            }
          });
        }
        //if true user is valid, and has minutes remaining
        if (Array.isArray(result)) {
          //extract data from result
          let max_viewers = result[0];
          let minutes_remaining = result[1];
          let display_name = result[2];
          let sessionID = result[3];

          //start creating lobby
          database.query(`SELECT * FROM resources WHERE free >= '${max_viewers}';`, con).then((server) => {
            //if no server is available
            if (server.length === 0) {
              console.log("noserver");
              //create new EC2 instance
              //i do not have a clue
              //get EC2 instance IP
              //same
              //get available resources
              //add to database

              //allocate resources
            } else {
              //grab the first available server and allocate resources
              allocRes(server[0].IP, max_viewers, minutes_remaining, display_name, sessionID).then((address) => {
                //tell the streamer what ip:port to connect to
                res.writeHead(200, {
                  "content-type": "text/html"
                });
                res.end(address);

              }).catch((err) => console.log(err));
            }
          });

        } else if (result === 0) {
          res.writeHead(401, {
            "content-type": "text/html"
          });
          res.end("Account minutes depleted");
        } else {
          return;
        }
      });
    } else if (result > 1) {
      console.error("SERIOUS ERROR: more than 1 session ID user");
    } else {
      //in case sessionID is invalid
      res.writeHead(401, {
        "content-type": "text/html"
      });
      res.end("Invalid credentials");
    }
  }).catch((error) => console.log(error));
});


//allocate resources and return ip:port of streamer
function allocRes(IP, max_viewers, minutes_remaining, display_name, sessID) {
  return new Promise((resolve, reject) => {
    //sign streamer TODO: include timestamp
    let sign = key.sign(Buffer.from(display_name));
    //create JSON request
    let jsonReq = {
      max_viewers: max_viewers,
      streamer_dn: display_name,
      time_remaining: minutes_remaining,
      signature: sign,
      sessid: sessID
    };
    //jsonReq = JSON.stringify(jsonReq);
    //POST to server
    axios
      .post(`http://${IP}:8003/allocRes`, jsonReq)
      .then(res => {
        //await response
        //put lobby in database in case successful
        if (res.status === 200) {
          //extract viewer and streamer port
          let viewerport = res.data.port.split("v")[1];
          let streamerport = (res.data.port.split("s")[1]).split("v")[0];

          database.query(`INSERT INTO streaming_on (IP, streamer_dpname, port, started_at) VALUES ('${IP}','${display_name}','${viewerport}', '${Date.now()}');`, con).then(() => {
            //update resouces
            database.query(`UPDATE resources SET free = '${res.data.resources}' WHERE IP = '${IP}';`, con).then(() => {
              console.log("lobby created");
              //return ip:port for streamer to promise caller
              resolve(`${IP}:${streamerport}`);
            }).catch((err) => {
              console.log(err);
              reject(err);
            });
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      })
      .catch(error => {
        //in case of error
        console.error(error)
        reject(err);
      })
  });
}

app.post("/streamended", function(req, res) {
  //get credentials
  database.query(`SELECT * FROM resources WHERE IP = '${req.connection.remoteAddress}';`,con).then((entry) => {
    //get public key of instance
    let instance_key = new rsa(entry[0].public_key);
    //get request parameters
    let signature = req.body.signature;
    let freeResources = req.body.freeres;
    let streamer_displayName = req.body.dp_name;
    //validate parameters as defined and non-null
    if(typeof signature === "undefined" || !signature || typeof freeResources === "undefined" || !freeResources || typeof streamer_displayName === "undefined" || !streamer_displayName){
        //parameters invalid, end conenction
        res.writeHead(400, {"content-type" : "text/html"});
        res.end("Bad parameters");
        return;
    }
    //parameters valid, continue
    //validate credentials
    try{
      if(instance_key.verify(Buffer.from(freeResources), Buffer.from(signature.data))){
        //valid signature
        //delete stream from database
        database.query(`DELETE FROM streaming_on WHERE streamer_dpname = '${streamer_displayName}';`,con);
        //update freeres
        database.query(`UPDATE resources SET free = '${freeResources}' WHERE IP = '${req.connection.remoteAddress}';`,con);
        //respond
        res.writeHead(200, {"content-type" : "text/html"});
        res.end("Stream officially ended");
        return;
      }else{
        //invalid signature
        res.writeHead(401, {"content-type":"text/html"});
        res.end("Invalid signature");
        return;
      }
    }catch(err){
      console.log(err);
    }
  }).catch((err) => console.log(err));
});
let server = app.listen(8002, () => console.log("running"));


function openServer(callback) {
  server = app.listen(8002, () => {
    callback();
  });

}

function closeServer() {
  server.close();
}
