//the process users connect to with WebSockets to get content updates, streamer connects to different port
let cluster = require("cluster");
let process = require("process");
let uWS = require("uWebSockets.js");

let viewerport = parseInt(process.argv[2].split("v")[1]);
let streamerport = parseInt((process.argv[2].split("s")[1]).split("v")[0]);

let listenSocket;

//IF MASTER
if (cluster.isMaster) {
  //---handlers---

  //if sub_worker crashes or exits successfully
  Object.values(cluster.workers).forEach(worker => {
    //on exit
    worker.on("exit", (code, signal) => {
      if (signal) {
        console.log(`worker was killed by signal: ${signal}`);
      } else if (code !== 0) {
        process.send(`stream sub_worker exited with error code: ${code}`);
        //create new sub_process immediately if exited unsuccessfully
        cluster.fork();
      } else {
        console.log("worker success");
      }
    });

    //received message from worker
    worker.on("message", (msg) => {
      console.log("msg: " + msg);
    });
  });

  //if master crashes or exits successfully
  process.on("exit", (code) => {
    //if exit meant
    if (code === 0) {
      //exit each worker
      Object.values(cluster.workers).forEach(worker => {
        worker.send("close");
      });
    } else {
      //TODO: do not kick off viewers and create instant new stream master
    }
  });

  //on message from parent
  process.on("message", (msg) => {
    //if requested to close / exit
    if (msg === "close") {
      //calls process.exit which closes all child_processes
      process.exit(0);
    }
  });
  //--- fork sub_processes ---
  //if allocated res only 0.5 still generate one process
  let allocated = parseInt(process.argv[3]);
  if (allocated < 1) {
    cluster.fork();
  } else if (1 <= allocated && allocated <= 4) {
    //spawn multiple processes according to allocated CPUS
    for (var i = 0; i < allocated; i++) {
      cluster.fork();
    }
  }
  //--- start server for streamer ---

  uWS.App().ws("/*", {
    compression: 0,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 60,

    //on open
    open: (ws, req) => {
      //check credentials
      let query = req.getQuery();
      //validate query as not having malicious input
      if (checkforcleaninput(query)) {
        //token is the right part of the query string
        let token = query.split("=")[1];
        //check token for validity
        if(token === process.argv[5]){
          //token is valid
        }
        else{
          //query token does not match streamer token
          ws.end("token invalid");
        }
      } else {
        //invalid input, do not bother to respond as is probably fingerprinting attempt
        ws.close();
        return;
      }
    },

    //get message
    message: (ws, message, isBinary) => {
      //convert ArrayBuffer to String
      message = Buffer.from(message).toString("utf-8");

      //if message signals to close the stream from the streamer
      if (message === "/endStream") {
        process.send("end stream request");
        uWS.us_listen_socket_close(listenSocket);
        listenSocket = null;

      } else {
        //if message is for stream data
        try {
          //parse it
          message = JSON.parse(message);
        } catch {
          //if parsing is unsuccessful return Bad request to streamer connection
          ws.send("400", isBinary);
          return;
        }
        //when above parsing successful send to children
        Object.values(cluster.workers).forEach((worker) => {
          worker.send({
            "json": message
          });
        });
        //return ok to streamer
        ws.send("200", isBinary)
      }
    },

    close: (ws, code, finalmsg) => {
      //TODO: only if no more streamer websockets are open
      process.send("end stream request");
    }

    //listen on streamerport
  }).listen(streamerport, (_listenSocket) => {
    if (_listenSocket) {
      let listenSocket = _listenSocket
      process.send("started");
    } else {

    }
  });

  //IF NOT MASTER
} else {
  //required store as variable for app.publish()
  let app = uWS.App();

  //when receiving message from top codeblock process
  process.on("message", (msg) => {
    if (msg === "close") {
      process.exit(0);
    } else {
      //TODO: other possibilities
      console.log("publishing : " + JSON.stringify(msg.json));
      app.publish("stream", msg.json);
    }
  });

let i = 1;
  //server for viewers to connect to
  app.ws('/*', {
    //options
    compression: 0,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 60,

    //handler on opened
    open: (ws, req) => {
      console.log("open:" + i);
      i++;
      //TODO:authenticate as non-malicious use
      //TODO: only if space available
      //TODO: if time remaining

      //listen to channel stream
      ws.subscribe('stream');
    }
  }).any('/*', (res, req) => {
    //HTTP unallowed
    res.end('HTTP unallowed');

  }).listen(viewerport, (listenSocket) => {

    if (listenSocket) {
      console.log('Listening to port ' + viewerport);
    }
  });
}

//if string only contains letters, numbers and =
function checkforcleaninput(str) {
  const regex = /^[a-zA-Z0-9=]+$/g;
  let found = str.match(regex);

  if (found !== null && found.length === 1) {
    if (found[0] === str) {
      return true;
    }
  }

  return false;
}
