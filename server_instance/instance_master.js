//controls and monitors the IC2 instance and assigns cores to stream_master processes to do their part.
const fork = require('child_process').fork;
const path = require("path");
const program = path.resolve('./stream.js');
const numCPUs = require('os').cpus().length;
const express = require("express");
const rsa = require("node-rsa");

//array containing references to stream_master processes
lobbys = {}
// # of cpus to be used
const streamSize = {
  VERY_SMALL: 0.5,
  SMALL: 1,
  MEDIUM: 2,
  LARGE: 3,
  VERY_LARGE: 4
}
//allowed port-pairings
let allowedPorts = [
  "s8910v8911", //streamer on port 8910, viewers on port 8911
  "s8912v8913",
  "s8914v8915",
  "s8916v8917",
  "s8918v8919",
  "s8920v8921",
  "s8922v8923"
];
//ports that are currently in use by the program
let occupiedPorts = [];
//remaining cpu space
let cpuresources = numCPUs;
let vieweres = numCPUs * 100000; // number is allowed viewers per cpu

//RSA public-key for verification
let key = new rsa('-----BEGIN PUBLIC KEY-----\n' +
  'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA2euIS0lta0X8SanSXLTU\n' +
  'mYNcvi2+wgqREOXWLp2fv3ahuprev3I3UCM9dF/MC/tMT9KumyNgAQLh4lB4A/Il\n' +
  'beGm1altPBunbbUCTwI28CgteBGmzdo0zImaEcsjQhoECEkj/jtopo49lWeHvi1H\n' +
  'essD+tgj/S7IoF/Uw3oWa1FqCBvQEpoj66bwryxGvBlUjQTuXGLfG9r9oxBiWlLG\n' +
  'YnIGGkN+HNp91EKBLc9wifQ3SuLRHRmxK8vFTmdAbaR2rR4eeWn6w/5xa3yLraiH\n' +
  'C+1bVHwmNn3vSNEGgQ8t5REDNW6uSJTUuGLNrhguUXp5D5/NGAAeCMGcKdqNqJ3o\n' +
  'EHNsmKp5GxNwDs5I6p5Dc2GOgXYKsIn9PB5srLzvYPJVXFFVYjHVPde4rGjcf3Tm\n' +
  'sYbRRtdrcBmFJhgISGWGz6weWzIUJjvIn1IuagIvMWHVuNdQTRv8ypvbaHKj2kF/\n' +
  'AqB1pdQtmNy+iST+5+fmLh0I1slXhoyCmeCyvlz7kCVeIPi4YbEI1yEkWXCWF3he\n' +
  'yvzKi6pp1FMkqWAtJs8aVAyMh+NjZaElVlq5e12Og4y1a1lircHTfTdFhsb5Hrln\n' +
  '9W6ngyQ6Pa2VzQGDUjyWGDyp5TJnqVG/JpDf12LzJlm8lJKJfaK0glGkaK0Ac5kH\n' +
  '7wTiy/FvjWAwbjzVyYpQueUCAwEAAQ==\n' +
  '-----END PUBLIC KEY-----');


//define app as using JSON
let app = express()
app.use(express.json())

//create child process
function createLobby(streamer_dn, stream_size, maximum_vw) {
  return new Promise((resolve, reject) => {
    //grab free t_portpair
    let t_portpair = allowedPorts.pop();
    console.log(t_portpair);
    //add portpair to occupied portpairs list
    occupiedPorts.push(t_portpair);
    //send portpair, allocated CPU space and maximum conurrent conenction numbers to process
    const parameters = [t_portpair, stream_size, maximum_vw];
    const options = {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    };
    //fork the program
    lobbys[streamer_dn] = fork(program, parameters, options);
    console.log(parameters);
    //set message display on recieve
    lobbys[streamer_dn].on('message', (msg) => {
      if (msg === "started") {
        console.log("started");
        cpuresources -= stream_size;
        vieweres -= maximum_vw;
        clearTimeout(lateClear);
        resolve(t_portpair);
      } else {
        console.log("msg: " + msg);
      }
    });
    //set message recieve on exit
    lobbys[streamer_dn].on('exit', (code, signal) => {
      if (signal) {
        console.log(`worker was killed by signal: ${signal}`);
      } else if (code !== 0) {
        console.log(`worker exited with error code: ${code}`);
        clearTimeout(lateClear);
        //TODO: might be a problem if rejected after resolve has already been called
        reject(code);
      } else {
        console.log('worker success!');
      }
    });
    //in case nothing happens after 3 seconds
    const lateClear = setTimeout(() => {
      reject("time passed");
    }, 3000);
  });
}

//on allocRes
app.post("/allocRes", function(req, res, next) {
  //console.log(JSON.stringify(req.body, null, 2))
  //create lobby with proper resouces
  let max_viewers;
  let streamer_dn;
  let time_remaining;
  try {
    //verify signature
    if (!key.verify(Buffer.from(req.body.streamer_dn), Buffer.from(req.body.signature.data))) {
      console.log("false");
      return;
    }
    console.log("past this point");
    //get requested parameters
    max_viewers = req.body.max_viewers; //max viewers in the lobby
    streamer_dn = req.body.streamer_dn; // streamer display name
    time_remaining = req.body.time_remaining; // time budget the streamer has left
  } catch (err) {
    console.error("Error gathering parameters: " + err);
    res.writeHead(400, {
      "content-type": "text/html"
    });
    res.end("bad request");
    return;
  }

  //allocate cpu space
  if (max_viewers <= 500) {
    cpualloc = streamSize.VERY_SMALL;
  } else if (max_viewers <= 2000) {
    cpualloc = streamSize.SMALL;
  } else if (max_viewers <= 20000) {
    cpualloc = streamSize.MEDIUM;
  } else if (max_viewers <= 100000) {
    cpualloc = streamSize.LARGE;
  } else if (max_viewers <= 1000000) {
    cpualloc = streamSize.VERY_LARGE;
  } else {
    //if max_viewers > 1M
    res.writeHead(400, {
      "content-type": "text/html"
    });
    res.end("max_viewers too large");
    return;
  }
  if (cpualloc > cpuresources) {
    //if allocated CPU space is greater than available one
    res.writeHead(400, {
      "content-type": "text/html"
    });
    res.end("max_viewers too large to be allocated");
    return;
  }
  createLobby(streamer_dn, cpualloc, max_viewers).then((portres) => {
    //answer according to protocol
    let response = {
      port: portres,
      resources: vieweres
    };
    response = JSON.stringify(response);
    res.writeHead(200, {
      "content-type": "application/json"
    });
    res.end(response);
    console.log("lobby started");
  }).catch((err) => {
    console.log("error: " + err);
  });

});

//delete this server
app.post("/allocDel", (req, res) => {
  try {
    //verify signature
    if ((Date.now() - 10) < req.body.timestamp) { //if within 10 seconds of request signature
      if (!key.verify(Buffer.from(req.body.timestamp), Buffer.from(req.body.signature.data))) {
        console.log("false");
        return;
      }
      console.log("past this point");
      lobbys.forEach((element) => {
        element.send("close");
      });
    }
  } catch (err) {
    console.error("Error closing: " + err);
    res.writeHead(400, {
      "content-type": "text/html"
    });
    res.end("bad request");
    return;
  }
});

//delete stream on this server
app.post("/delRes", (req, res) => {

});
app.listen(8003, () => console.log("running"));
