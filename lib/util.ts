export const delay = ms => new Promise(res => setTimeout(res, ms));

export const safe = function(obj) {
  return new Proxy(obj, {
    get: function(target, name) {
      const result = target[name];
      if (!!result) {
        return result instanceof Object ? safe(result) : result;
      }
      return safe({});
    }
  });
};


export const Homey = require("homey");
// exports.delay = delay;
// exports.safe = safe;
// exports.Homey = Homey;
// module.exportss.Queue = Queue;
// exports = {
//   delay: delay,
//   safe: safe,
//   Homey: Homey,
// };