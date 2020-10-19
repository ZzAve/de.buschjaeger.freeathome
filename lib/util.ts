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

export class Queue<T> {
  _store: T[] = [];
  push(val: T) {
    this._store.push(val);
  }

  pop(): T | undefined {
    return this._store.shift();
  }
}

export const capabilityMapping = {
  onoff: "idp0000",
  dim: "idp0002",
  windowcoverings_set: "idp0002",
  windowcoverings_state: "idp0001"
};
