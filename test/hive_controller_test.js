let assert = require("assert");
let sinon = require("sinon");



describe("hive_controller", () => {
  it("handle key not found", () => {
    assert(true);
  });
  describe("#/stream", () => {
    //TODO: mock SQL queries
    it("/stream called with correct parameters - return port and ip", () => {
      assert(true);
    });
    it("/stream called with invalid username - return 401", () => {
      assert(true);
    });
    it("/stream called with invalid sessionID - return 401", () => {
      assert(true);
    });
    it("/stream called with neither sessID nor username should return 400", () => {
      assert(true);
    });
    it("/stream called with dirty input - return 401", () => {
      assert(true);
    });
    it("/stream streamer is already streaming - return 401", () => {
      assert(true);
    });
    it("/stream streamer has no more account minutes - return 401", () => {
      assert(true);
    });
    it("/stream lobby didn't start - return 503 (?)", () => {
      assert(true);
    });

  });
  describe("#allocRes function", () => {
    //replace axios.post and database insertion (query)
    it("lobby started successfully - return address, check insertions", () => {
      //allocRes = logError = app.__get__('allocRes');
      //allocRes("127.0.0.1", 2000, 20, "Shelly", "12312312318193").then(() => {console.log("succ")}).catch((err) => console.log(err));
      assert(true);
      done();
    });
    it("lobby not started successfully - try again, return error", () => {
      assert(true);
    });
  });
});